import { createClient } from '@libsql/client';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Carrega variáveis do .env apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega configurações
const config = JSON.parse(readFileSync(join(__dirname, '../config.json'), 'utf-8'));

async function testAll() {
  console.log('🧪 Executando testes...\n');
  
  // 1. Teste da API brapi (requisições individuais para plano gratuito)
  console.log('1️⃣ Testando API brapi (plano gratuito)...');
  try {
    // Testa apenas 1 código para evitar rate limit no teste
    const testCode = config.stocks?.[0] || config.fiis?.[0] || 'PETR4';
    
    console.log(`   📋 Testando com 1 código: ${testCode}`);
    console.log(`   ⚠️ Plano gratuito: 1 ativo por requisição`);
    
    const apiKey = process.env.BRAPI_API_KEY || 'demo';
    const url = `${config.api.brapi_base_url}/quote/${testCode}?token=${apiKey}`;
    
    console.log(`   🔗 URL: ${url.replace(apiKey, '***')}`);
    console.log(`   🔑 API Key: ${apiKey === 'demo' ? '⚠️ DEMO (muito limitada)' : '✅ Configurada'}`);
    
    // Implementa delay antes da requisição de teste
    console.log(`   ⏳ Aguardando 1s antes da requisição...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(url);
    
    if (response.status === 429) {
      console.log(`   ⚠️ Rate limit atingido! Aguarde alguns minutos.`);
      console.log(`   💡 Com plano gratuito, aguarde pelo menos 60s entre testes.`);
      return;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`   ✅ API OK! Código ${testCode} encontrado`);
    
    if (data.results && data.results.length > 0) {
      const stock = data.results[0];
      const tipo = config.stocks?.includes(stock.symbol) ? '📈 Ação' : '🏢 FII';
      const preco = stock.regularMarketPrice?.toFixed(2) || 'N/A';
      console.log(`   📊 ${tipo} ${stock.symbol}: R$ ${preco}`);
    }
    
  } catch (error) {
    if (error.message.includes('429')) {
      console.error('   ❌ Rate limit atingido.');
      console.log('   💡 Plano gratuito: aguarde 60s entre requisições');
    } else {
      console.error('   ❌ Erro na API:', error.message);
    }
  }
  
  // 2. Teste do banco Turso
  console.log('\n2️⃣ Testando banco Turso...');
  
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('   ❌ Variáveis de ambiente não configuradas:');
    console.error('      TURSO_DATABASE_URL:', !!process.env.TURSO_DATABASE_URL);
    console.error('      TURSO_AUTH_TOKEN:', !!process.env.TURSO_AUTH_TOKEN);
    return;
  }
  
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  
  try {
    // Testa conexão
    const countResult = await turso.execute('SELECT COUNT(*) as count FROM closings');
    console.log(`   ✅ Conexão OK! Total de registros: ${countResult.rows[0].count}`);
    
    // Testa inserção
    const testDate = new Date().toISOString().split('T')[0];
    const testCode = 'TEST01';
    const testValue = 99.99;
    
    await turso.execute({
      sql: 'INSERT OR REPLACE INTO closings (date, code, value) VALUES (?, ?, ?)',
      args: [testDate, testCode, testValue]
    });
    console.log(`   ✅ Inserção teste OK: ${testCode} = R$ ${testValue}`);
    
    // Remove o registro de teste
    await turso.execute({
      sql: 'DELETE FROM closings WHERE code = ?',
      args: [testCode]
    });
    console.log(`   🗑️ Registro de teste removido`);
    
    // Mostra últimos registros
    const recentResults = await turso.execute(`
      SELECT date, code, value 
      FROM closings 
      ORDER BY date DESC, code ASC 
      LIMIT 5
    `);
    
    if (recentResults.rows.length > 0) {
      console.log('   📈 Últimos registros:');
      recentResults.rows.forEach(row => {
        console.log(`      ${row.date} | ${row.code} | R$ ${Number(row.value).toFixed(2)}`);
      });
    } else {
      console.log('   📭 Nenhum registro encontrado');
    }
    
  } catch (error) {
    console.error('   ❌ Erro no banco:', error.message);
  } finally {
    turso.close();
  }
  
  // 3. Teste de configuração
  console.log('\n3️⃣ Testando configuração...');
  console.log(`   📋 Total de ações: ${config.stocks?.length || 0}`);
  if (config.stocks?.length > 0) {
    console.log(`   📈 Ações: ${config.stocks.slice(0, 5).join(', ')}${config.stocks.length > 5 ? '...' : ''}`);
  }
  
  console.log(`   🏢 Total de FIIs: ${config.fiis?.length || 0}`);
  if (config.fiis?.length > 0) {
    console.log(`   🏢 FIIs: ${config.fiis.slice(0, 5).join(', ')}${config.fiis.length > 5 ? '...' : ''}`);
  }
  
  console.log(`   ⏰ Horário configurado: ${config.schedule?.hour}:${config.schedule?.minute?.toString().padStart(2, '0')}`);
  console.log(`   🌎 Fuso horário: ${config.schedule?.timezone}`);
  console.log(`   📦 Tamanho do lote: ${config.api?.batch_size}`);
  console.log(`   🔄 Tentativas de retry: ${config.api?.retry_attempts}`);
  
  // Valida configuração
  const problemas = [];
  if (!config.stocks || config.stocks.length === 0) {
    problemas.push('Nenhuma ação configurada');
  }
  if (!config.fiis || config.fiis.length === 0) {
    problemas.push('Nenhum FII configurado');
  }
  if (!config.schedule?.hour || !config.schedule?.minute) {
    problemas.push('Horário não configurado corretamente');
  }
  
  if (problemas.length > 0) {
    console.log(`   ⚠️ Problemas encontrados:`);
    problemas.forEach(problema => console.log(`      - ${problema}`));
  } else {
    console.log(`   ✅ Configuração válida!`);
  }
}

testAll().catch(error => {
  console.error('Erro nos testes:', error);
  process.exit(1);
});