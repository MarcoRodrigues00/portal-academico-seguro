# Portal Acadêmico Seguro

## Contexto do projeto
Este projeto é um trabalho de faculdade chamado Portal Acadêmico Seguro.

## Topologia correta
- pfSense = borda / firewall / NAT / segmentação
- Host .50 = DMZ + ADMIN / monitoramento
- Host .34 = APP + DATA
- Kali = apenas pentest / validação
- Guacamole é fornecido pelo laboratório e não faz parte do projeto

## Distribuição por host

### Host .50
DMZ:
- nginx reverse proxy
- ModSecurity / WAF
- mail-gateway / servidor de e-mail

ADMIN:
- Wazuh
- Prometheus
- Grafana
- Restic
- node-exporter

### Host .34
APP:
- frontend
- backend
- Keycloak

DATA:
- PostgreSQL da aplicação
- PostgreSQL do Keycloak
- compartilhamento de arquivos

## Regras importantes
- Não mudar a topologia
- Usar Keycloak como autenticação principal
- Não substituir Keycloak por auth própria da aplicação
- Não trocar PostgreSQL
- Não fazer overengineering
- Não criar arquitetura exagerada
- Não criar arquivos desnecessários
- Não adicionar bibliotecas fora da stack sem necessidade real
- Sempre manter o código simples, legível e funcional
- Sempre editar apenas o necessário
- Sempre mostrar no final quais arquivos foram criados ou alterados
- Sempre explicar de forma prática e objetiva

## Stack obrigatória

### Frontend
- React
- Vite
- TypeScript
- TailwindCSS
- React Router
- Axios

### Backend
- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Zod
- helmet
- cors
- express-rate-limit
- winston

### Autenticação
- Keycloak
- Login real desde o início
- Backend deve validar o token emitido pelo Keycloak
- RBAC deve usar papéis/roles vindos do Keycloak
- Não implementar login local com bcrypt/jsonwebtoken próprios se não for realmente necessário

## Funcionalidades mínimas do MVP

### Páginas
- login
- cadastro
- cursos preparatórios públicos
- dashboard
- requerimentos

### Rotas backend
- GET /api/auth/me
- GET /api/courses/public
- POST /api/requests
- GET /api/requests/me
- GET /health

## Banco da aplicação
- users
- courses
- requests

## Segurança obrigatória
- integração com Keycloak
- validação de token no backend
- RBAC simples
- Helmet
- CORS restrito
- rate limit
- tratamento de erros sem expor stack
- logs com Winston
- Prisma sem SQL raw
- .env.example
- graceful shutdown
- validação de variáveis de ambiente
- trust proxy configurável por env

## Ordem de trabalho
1. preparação do backend
2. banco da aplicação
3. banco do Keycloak
4. Prisma e migrations
5. integração do backend com Keycloak
6. rotas protegidas e públicas
7. frontend
8. integração frontend + backend + Keycloak
9. testes
10. organização para futura publicação no host .50

## Forma de trabalho esperada
- Trabalhar por etapas pequenas
- Não despejar tudo de uma vez
- Primeiro garantir a base mínima funcionando
- Depois evoluir com segurança
- Sempre priorizar MVP funcional
- Sempre respeitar a arquitetura definida acima
