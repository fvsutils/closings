# Stock Data Collector

Coletor automatizado de dados de ações e FIIs da B3 usando GitHub Actions, brapi.dev e Turso (SQLite).

## 📋 Funcionalidades

- ✅ Coleta automática de preços de fechamento via brapi.dev
- ✅ Armazenamento em banco SQLite (Turso)
- ✅ Execução agendada via GitHub Actions
- ✅ Configuração flexível via JSON
- ✅ Tratamento de erros e retry automático
- ✅ Processamento em lotes para otimização

## 🚀 Configuração

### 1. Clone e Configure o Projeto

```bash
# Clone o repositório
git clone <seu-repositorio>
cd stock-data-collector

# Instale as dependências
npm install
```

### 2. Configure o Turso

1. Crie uma conta em [turso.tech](https://turso.tech)
2. Crie um banco de dados
3. Anote a `DATABASE_URL` e `AUTH_TOKEN`

### 3. Configure os Secrets no GitHub

No seu repositório GitHub, vá em **Settings → Secrets and variables → Actions** e adicione:

- `TURSO_DATABASE_URL`: URL do seu banco Turso
- `TURSO_AUTH_TOKEN`: Token de autenticação do Turso
- `BRAPI_API_KEY`: Sua chave da API brapi.dev

### 4. Personalize a Configuração

Edite o arquivo `config.json`:

```json
{
  "schedule": {
    "hour": 18,
    "minute": 5,
    "timezone": "America/Sao_Paulo"
  },
  "stocks": ["PETR4", "VALE3", "ITUB4"],
  "fiis": ["HGLG11", "KNRI11", "XPML11"]
}
```

### 5. Ajuste o Cronograma

No arquivo `.github/workflows/stock-collector.yml`, ajuste o cron para seu horário preferido:

```yaml
schedule:
  # Às 21:05 UTC (18:05 horário de Brasília)
  - cron: '5 21 * * 1-5'
```

## 🧪 Testando Localmente

Antes de fazer deploy, teste localmente:

```bash
# Configure as variáveis de ambiente
export TURSO_DATABASE_URL="sua-url-aqui"
export TURSO_AUTH_TOKEN="seu-token-aqui"

# Execute o teste de conexão
npm run test

# Execute o coletor
npm start
```

## 📊 Estrutura do Banco

```sql
CREATE TABLE closings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date NUMERIC NOT NULL,
    code TEXT NOT NULL,
    value REAL NOT NULL
);
```

## 📁 Estrutura do Projeto

```
stock-data-collector/
├── .github/
│   └── workflows/
│       └── stock-collector.yml
├── src/
│   ├── collect-stocks.js
│   └── test-connection.js
├── .env.example
├── .gitignore
├── config.json
├── package.json
└── README.md
```

## ⚙️ Como Funciona

1. **Agendamento**: GitHub Actions executa o workflow nos horários configurados
2. **Coleta**: Script busca dados na API brapi.dev em lotes
3. **Processamento**: Dados são formatados e validados
4. **Armazenamento**: Dados são salvos no Turso com INSERT OR REPLACE
5. **Log**: Processo é registrado nos logs do GitHub Actions

## 🛠️ Personalização

### Alterar Horário de Execução

Edite o cron no arquivo `stock-collector.yml`:

```yaml
schedule:
  - cron: '0 22 * * 1-5'  # 22:00 UTC todos os dias úteis
```

### Adicionar Mais Ativos

Edite o arquivo `config.json`:

```json
{
  "stocks": ["PETR4", "VALE3", "NOVO_ATIVO"],
  "fiis": ["HGLG11", "NOVO_FII"]
}
```

### Configurar Retry e Batching

```json
{
  "api": {
    "batch_size": 10,
    "retry_attempts": 3,
    "retry_delay_ms": 1000
  }
}
```

## 📝 Logs

Os logs são visíveis na aba **Actions** do GitHub:

```
🚀 Iniciando coleta de dados...
📅 Data: 19/09/2025
⏰ Horário: 18:05:32

🔍 Testando conexão com o banco...
✅ Conexão OK! Total de registros: 1250

📊 Processando 10 ações...
✅ PETR4: R$ 32.45
✅ VALE3: R$ 68.90
...

📈 Resumo da coleta:
• Total de ativos: 20
• Ações: 10
• FIIs: 10
• Data: 2025-09-19

✅ Coleta finalizada!
```

## 🔧 Solução de Problemas

### Erro de Conexão com Turso
- Verifique se os secrets estão configurados corretamente
- Teste localmente primeiro

### API brapi retorna erro
- Verifique se os códigos estão corretos
- Confirme se sua API key está válida
- A API tem rate limiting, o script já implementa delays
- Use a API key real para ter mais requests disponíveis

### Workflow não executa
- Verifique a sintaxe do cron
- GitHub pode atrasar execuções em horários de pico

## 📈 Melhorias Futuras

- [ ] Notificações por email/Slack em caso de erro
- [ ] Dashboard para visualizar os dados
- [ ] Backup automático dos dados
- [ ] Coleta de dados intraday
- [ ] Cálculo de indicadores técnicos

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.