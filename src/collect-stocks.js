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

// Inicializa cliente Turso
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

class StockDataCollector {
  constructor() {
    this.apiUrl = config.api.brapi_base_url;
    this.batchSize = config.api.batch_size;
    this.retryAttempts = config.api.retry_attempts;
    this.retryDelay = config.api.retry_delay_ms;
    this.rateLimitDelay = config.api.rate_limit_delay_ms || 5000;
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 1000; // Mínimo 1 segundo entre requests
    
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      console.log(`   ⏳ Aguardando ${waitTime}ms para respeitar rate limit...`);
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  async fetchWithRetry(url, attempts = this.retryAttempts) {
    await this.waitForRateLimit();
    
    try {
      console.log(`Fazendo requisição para: ${url.replace(process.env.BRAPI_API_KEY || 'demo', '***')}`);
      const response = await fetch(url);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.rateLimitDelay;
        
        console.log(`⚠️ Rate limit atingido! Aguardando ${waitTime/1000}s...`);
        
        if (attempts > 1) {
          await this.sleep(waitTime);
          return this.fetchWithRetry(url, attempts - 1);
        } else {
          throw new Error(`Rate limit excedido após ${this.retryAttempts} tentativas`);
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Erro na requisição (tentativas restantes: ${attempts - 1}):`, error.message);
      
      if (attempts > 1 && !error.message.includes('Rate limit excedido')) {
        await this.sleep(this.retryDelay);
        return this.fetchWithRetry(url, attempts - 1);
      }
      
      throw error;
    }
  }

  async fetchStockData(codes) {
    // Para plano gratuito: sempre 1 código por requisição
    if (codes.length > 1) {
      console.log(`⚠️ Plano gratuito detectado: fazendo ${codes.length} requisições individuais`);
      const results = [];
      
      for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        console.log(`   📊 ${i + 1}/${codes.length}: Buscando ${code}...`);
        
        try {
          const singleResult = await this.fetchSingleStock(code);
          if (singleResult) {
            results.push(singleResult);
            console.log(`   ✅ ${code}: R$ ${singleResult.value.toFixed(2)}`);
          }
        } catch (error) {
          console.error(`   ❌ ${code}: ${error.message}`);
        }
        
        // Delay entre requisições individuais (exceto na última)
        if (i < codes.length - 1) {
          await this.sleep(this.rateLimitDelay);
        }
      }
      
      return results;
    } else {
      // Requisição única
      return await this.fetchSingleStock(codes[0]) ? [await this.fetchSingleStock(codes[0])] : [];
    }
  }

  async fetchSingleStock(code) {
    const apiKey = process.env.BRAPI_API_KEY || 'demo';
    const url = `${this.apiUrl}/quote/${code}?token=${apiKey}&interval=1d`;
    
    try {
      const data = await this.fetchWithRetry(url);
      
      if (!data.results || data.results.length === 0) {
        throw new Error('Nenhum resultado encontrado na API');
      }
      
      const stock = data.results[0];
      return {
        code: stock.symbol,
        value: stock.regularMarketPrice,
        date: new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error(`Erro ao buscar ${code}:`, error.message);
      return null;
    }
  }

  async saveToDatabase(stockData) {
    if (stockData.length === 0) {
      console.log('Nenhum dado para salvar');
      return;
    }

    try {
      // Prepara a query de inserção
      const insertQuery = `
        INSERT OR REPLACE INTO closings (date, code, value) 
        VALUES (?, ?, ?)
      `;

      console.log(`Salvando ${stockData.length} registros no banco...`);
      
      // Insere os dados em batch
      for (const stock of stockData) {
        await turso.execute({
          sql: insertQuery,
          args: [stock.date, stock.code, stock.value]
        });
        
        console.log(`✅ ${stock.code}: R$ ${stock.value.toFixed(2)}`);
      }
      
      console.log(`✅ ${stockData.length} registros salvos com sucesso!`);
    } catch (error) {
      console.error('Erro ao salvar no banco de dados:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      console.log('🔍 Testando conexão com o banco...');
      const result = await turso.execute('SELECT COUNT(*) as count FROM closings');
      console.log(`✅ Conexão OK! Total de registros: ${result.rows[0].count}`);
      return true;
    } catch (error) {
      console.error('❌ Erro na conexão com o banco:', error);
      return false;
    }
  }

  async processInBatches(codes, type) {
    const results = [];
    
    console.log(`\n📊 Processando ${codes.length} ${type} (1 requisição por ativo)...`);
    
    // Com plano gratuito, processamos 1 por vez, mas mantemos a estrutura de "lotes" para organização
    const batchSize = Math.min(this.batchSize, 5); // Máximo 5 por lote para organizar logs
    
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(codes.length / batchSize);
      
      console.log(`\n📦 Lote ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
      
      try {
        // fetchStockData já faz requisições individuais automaticamente
        const batchData = await this.fetchStockData(batch);
        results.push(...batchData);
        
        console.log(`✅ Lote ${batchNum}: ${batchData.length}/${batch.length} códigos obtidos`);
      } catch (error) {
        console.error(`❌ Erro no lote ${batchNum}:`, error.message);
      }
      
      // Pausa entre lotes (não entre códigos individuais, já feito no fetchStockData)
      if (i + batchSize < codes.length) {
        console.log(`⏸️ Pausa de 3s entre lotes...`);
        await this.sleep(3000);
      }
    }
    
    return results;
  }

  async run() {
    console.log('🚀 Iniciando coleta de dados...');
    console.log(`📅 Data: ${new Date().toLocaleDateString('pt-BR')}`);
    console.log(`⏰ Horário: ${new Date().toLocaleTimeString('pt-BR')}`);
    
    // Testa conexão
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      process.exit(1);
    }
    
    try {
      const allData = [];
      
      // Processa ações
      if (config.stocks && config.stocks.length > 0) {
        const stockData = await this.processInBatches(config.stocks, 'ações');
        allData.push(...stockData);
      }
      
      // Processa FIIs
      if (config.fiis && config.fiis.length > 0) {
        const fiiData = await this.processInBatches(config.fiis, 'FIIs');
        allData.push(...fiiData);
      }
      
      // Salva todos os dados
      if (allData.length > 0) {
        await this.saveToDatabase(allData);
        
        console.log('\n📈 Resumo da coleta:');
        console.log(`• Total de ativos: ${allData.length}`);
        console.log(`• Ações: ${allData.filter(item => config.stocks.includes(item.code)).length}`);
        console.log(`• FIIs: ${allData.filter(item => config.fiis.includes(item.code)).length}`);
        console.log(`• Data: ${allData[0]?.date || 'N/A'}`);
      } else {
        console.log('⚠️ Nenhum dado foi coletado');
      }
      
    } catch (error) {
      console.error('❌ Erro durante a execução:', error);
      process.exit(1);
    } finally {
      // Fecha conexão com o banco
      turso.close();
      console.log('\n✅ Coleta finalizada!');
    }
  }
}

// Executa o coletor
if (import.meta.url === `file://${process.argv[1]}`) {
  const collector = new StockDataCollector();
  collector.run().catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}