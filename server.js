const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração do MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '9090', // Insira a senha do seu MySQL aqui se houver
    database: 'clinica_estetica'
});

// Configuração do Handlebars com permissão e helpers customizados
app.use(express.static(path.join(__dirname, 'public')));
app.engine('handlebars', engine({
    helpers: {
        eq: function (a, b) { return a === b; }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'chave_secreta_clinica_verde',
    resave: false,
    saveUninitialized: false
}));

// Variáveis Globais para as Views
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Middleware de Autenticação
function loginRequired(req, res, next) {
    if (!req.session.user_id) {
        return res.redirect('/login');
    }
    next();
}

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

app.get('/', async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos');
    res.render('home', { procedimentos });
});

app.get('/agendar', async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos');
    res.render('agendar', { procedimentos });
});

app.post('/agendar', async (req, res) => {
    const { procedimento_id, cliente_nome, cliente_telefone, data_hora } = req.body;
    try {
        await db.query(
            'INSERT INTO agendamentos (procedimento_id, cliente_nome, cliente_telefone, data_hora, status) VALUES (?, ?, ?, ?, "Pendente")',
            [procedimento_id, cliente_nome, cliente_telefone, data_hora]
        );
        const [procedimentos] = await db.query('SELECT * FROM procedimentos');
        res.render('agendar', { success: 'Agendamento realizado com sucesso! Aguarde nosso contato.', procedimentos });
    } catch (error) {
        const [procedimentos] = await db.query('SELECT * FROM procedimentos');
        res.render('agendar', { error: 'Erro ao agendar.', procedimentos });
    }
});

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const [users] = await db.query('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password]);
    
    if (users.length > 0) {
        req.session.user_id = users[0].id;
        req.session.user_name = users[0].nome_completo;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Usuário ou senha inválidos.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==========================================
// ROTAS ADMINISTRATIVAS
// ==========================================

// Dashboard com Indicadores e Gráficos
app.get('/admin', loginRequired, async (req, res) => {
    try {
        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM agendamentos');
        const [[{ pendentes }]] = await db.query('SELECT COUNT(*) as pendentes FROM agendamentos WHERE status = "Pendente"');
        const [[{ realizados }]] = await db.query('SELECT COUNT(*) as realizados FROM agendamentos WHERE status = "Realizado"');

        // Dados para o Gráfico: Quantidade de agendamentos por Procedimento
        const [graficoDados] = await db.query(`
            SELECT p.nome as procedimento, COUNT(a.id) as quantidade
            FROM procedimentos p
            LEFT JOIN agendamentos a ON p.id = a.procedimento_id
            GROUP BY p.id, p.nome
        `);

        res.render('admin/dashboard', {
            total,
            pendentes,
            realizados,
            graficoDados: JSON.stringify(graficoDados)
        });
    } catch (error) {
        res.render('admin/dashboard', { error: 'Erro ao carregar indicadores.' });
    }
});

// CRUD - Listar
app.get('/admin/procedimentos', loginRequired, async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos');
    res.render('admin/procedimentos', { procedimentos });
});

// CRUD - Criar ou Atualizar
app.post('/admin/procedimentos/salvar', loginRequired, async (req, res) => {
    const { id, nome, descricao, duracao_minutos, preco } = req.body;
    try {
        if (id && id.trim() !== "") {
            // Se o ID existe e não está vazio, trata-se de um UPDATE
            await db.query('UPDATE procedimentos SET nome=?, descricao=?, duracao_minutos=?, preco=? WHERE id=?', 
                [nome, descricao, duracao_minutos, preco, id]);
        } else {
            // Caso contrário, trata-se de um INSERT Novo
            await db.query('INSERT INTO procedimentos (nome, descricao, duracao_minutos, preco) VALUES (?, ?, ?, ?)', 
                [nome, descricao, duracao_minutos, preco]);
        }
        res.redirect('/admin/procedimentos');
    } catch (error) {
        const [procedimentos] = await db.query('SELECT * FROM procedimentos');
        res.render('admin/procedimentos', { error: 'Erro ao salvar procedimento.', procedimentos });
    }
});

// CRUD - Excluir
app.post('/admin/procedimentos/excluir/:id', loginRequired, async (req, res) => {
    try {
        await db.query('DELETE FROM procedimentos WHERE id = ?', [req.params.id]);
        res.redirect('/admin/procedimentos');
    } catch (error) {
        const [procedimentos] = await db.query('SELECT * FROM procedimentos');
        res.render('admin/procedimentos', { error: 'Não é possível excluir procedimentos vinculados a agendamentos.', procedimentos });
    }
});

// Listar Agendamentos Administrativos
app.get('/admin/agendamentos', loginRequired, async (req, res) => {
    const query = `
        SELECT a.id, a.cliente_nome, a.cliente_telefone, a.data_hora, a.status, p.nome AS procedimento_nome 
        FROM agendamentos a 
        JOIN procedimentos p ON a.procedimento_id = p.id
        ORDER BY a.data_hora DESC
    `;
    const [agendamentos] = await db.query(query);
    
    agendamentos.forEach(a => {
        a.data_formatada = new Date(a.data_hora).toLocaleString('pt-BR');
    });

    res.render('admin/agendamentos', { agendamentos });
});

// Atualizar Status do Agendamento (Pendente / Realizado)
app.post('/admin/agendamentos/status/:id', loginRequired, async (req, res) => {
    const { status } = req.body;
    await db.query('UPDATE agendamentos SET status = ? WHERE id = ?', [status, req.params.id]);
    res.redirect('/admin/agendamentos');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});