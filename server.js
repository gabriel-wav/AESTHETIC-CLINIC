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
    password: '9090', // COLOQUE A SENHA DO SEU MYSQL AQUI
    database: 'clinica_estetica'
});

// Configuração do Handlebars (Template Engine)
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'chave_secreta_clinica_verde',
    resave: false,
    saveUninitialized: false
}));

// Variáveis Globais para as Views (Sessão e Mensagens)
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// --- Middleware de Autenticação ---
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
            'INSERT INTO agendamentos (procedimento_id, cliente_nome, cliente_telefone, data_hora) VALUES (?, ?, ?, ?)',
            [procedimento_id, cliente_nome, cliente_telefone, data_hora]
        );
        res.render('agendar', { success: 'Agendamento realizado com sucesso! Aguarde nosso contato.', procedimentos: await db.query('SELECT * FROM procedimentos').then(r => r[0]) });
    } catch (error) {
        res.render('agendar', { error: 'Erro ao agendar.', procedimentos: await db.query('SELECT * FROM procedimentos').then(r => r[0]) });
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
// ROTAS ADMINISTRATIVAS (CRUD)
// ==========================================

app.get('/admin', loginRequired, (req, res) => {
    res.render('admin/dashboard');
});

// READ - Listar Procedimentos
app.get('/admin/procedimentos', loginRequired, async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos');
    res.render('admin/procedimentos', { procedimentos });
});

// CREATE / UPDATE - Salvar Procedimento
app.post('/admin/procedimentos/salvar', loginRequired, async (req, res) => {
    const { id, nome, descricao, duracao_minutos, preco } = req.body;
    if (id) {
        // Atualizar
        await db.query('UPDATE procedimentos SET nome=?, descricao=?, duracao_minutos=?, preco=? WHERE id=?', 
            [nome, descricao, duracao_minutos, preco, id]);
    } else {
        // Inserir Novo
        await db.query('INSERT INTO procedimentos (nome, descricao, duracao_minutos, preco) VALUES (?, ?, ?, ?)', 
            [nome, descricao, duracao_minutos, preco]);
    }
    res.redirect('/admin/procedimentos');
});

// DELETE - Excluir Procedimento
app.post('/admin/procedimentos/excluir/:id', loginRequired, async (req, res) => {
    try {
        await db.query('DELETE FROM procedimentos WHERE id = ?', [req.params.id]);
        res.redirect('/admin/procedimentos');
    } catch (error) {
        res.redirect('/admin/procedimentos'); // Ideal seria tratar restrição de chave estrangeira
    }
});

// READ - Listar Agendamentos
app.get('/admin/agendamentos', loginRequired, async (req, res) => {
    const query = `
        SELECT a.id, a.cliente_nome, a.cliente_telefone, a.data_hora, a.status, p.nome AS procedimento_nome 
        FROM agendamentos a 
        JOIN procedimentos p ON a.procedimento_id = p.id
        ORDER BY a.data_hora DESC
    `;
    const [agendamentos] = await db.query(query);
    
    // Formatar data pro Handlebars exibir bonito
    agendamentos.forEach(a => {
        a.data_formatada = new Date(a.data_hora).toLocaleString('pt-BR');
    });

    res.render('admin/agendamentos', { agendamentos });
});

// Iniciar o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});