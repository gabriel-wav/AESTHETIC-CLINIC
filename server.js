const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = 3000;

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '9090',
    database: 'clinica_estetica'
});

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

app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'chave_secreta_clinica_verde',
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// ==========================================
// MIDDLEWARES DE AUTENTICAÇÃO
// ==========================================

function loginRequired(req, res, next) {
    if (!req.session.user_id) return res.redirect('/login');
    next();
}

function clienteLoginRequired(req, res, next) {
    if (!req.session.cliente_id) return res.redirect('/cliente/login?redirect=' + encodeURIComponent(req.originalUrl));
    next();
}

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

app.get('/', async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos WHERE ativo = 1');
    res.render('home', { procedimentos });
});

// ==========================================
// AUTENTICAÇÃO DO CLIENTE
// ==========================================

app.get('/cliente/cadastro', (req, res) => {
    if (req.session.cliente_id) return res.redirect('/consultar');
    res.render('cliente/cadastro');
});

app.post('/cliente/cadastro', async (req, res) => {
    const { username, email, password, nome_completo, telefone } = req.body;
    try {
        const [existing] = await db.query(
            'SELECT id FROM clientes WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            return res.render('cliente/cadastro', { error: 'Usuário ou e-mail já cadastrado.' });
        }
        const [result] = await db.query(
            'INSERT INTO clientes (username, email, password, nome_completo, telefone) VALUES (?, ?, ?, ?, ?)',
            [username, email, password, nome_completo, telefone]
        );
        req.session.cliente_id = result.insertId;
        req.session.cliente_name = nome_completo;
        res.redirect('/agendar');
    } catch (error) {
        res.render('cliente/cadastro', { error: 'Erro ao criar conta. Tente novamente.' });
    }
});

app.get('/cliente/login', (req, res) => {
    if (req.session.cliente_id) return res.redirect('/consultar');
    res.render('cliente/login', { redirect: req.query.redirect || '/consultar' });
});

// Login aceita username OU email
app.post('/cliente/login', async (req, res) => {
    const { username, password, redirect } = req.body;
    const [clientes] = await db.query(
        'SELECT * FROM clientes WHERE (username = ? OR email = ?) AND password = ?',
        [username, username, password]
    );
    if (clientes.length > 0) {
        req.session.cliente_id = clientes[0].id;
        req.session.cliente_name = clientes[0].nome_completo;
        return res.redirect(redirect || '/consultar');
    }
    res.render('cliente/login', { error: 'Usuário, e-mail ou senha inválidos.', redirect });
});

app.get('/cliente/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==========================================
// PERFIL DO CLIENTE
// ==========================================

app.get('/cliente/perfil', clienteLoginRequired, async (req, res) => {
    const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id]);
    res.render('cliente/perfil', { cliente });
});

app.post('/cliente/perfil', clienteLoginRequired, async (req, res) => {
    const { nome_completo, email, telefone, username, nova_senha } = req.body;
    try {
        // verifica se username ou email já pertencem a outro cliente
        const [conflito] = await db.query(
            'SELECT id FROM clientes WHERE (username = ? OR email = ?) AND id != ?',
            [username, email, req.session.cliente_id]
        );
        if (conflito.length > 0) {
            const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id]);
            return res.render('cliente/perfil', { cliente, error: 'Usuário ou e-mail já está em uso por outra conta.' });
        }

        if (nova_senha && nova_senha.trim() !== '') {
            await db.query(
                'UPDATE clientes SET nome_completo=?, email=?, telefone=?, username=?, password=? WHERE id=?',
                [nome_completo, email, telefone, username, nova_senha, req.session.cliente_id]
            );
        } else {
            await db.query(
                'UPDATE clientes SET nome_completo=?, email=?, telefone=?, username=? WHERE id=?',
                [nome_completo, email, telefone, username, req.session.cliente_id]
            );
        }

        req.session.cliente_name = nome_completo;
        const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id]);
        res.render('cliente/perfil', { cliente, success: 'Perfil atualizado com sucesso!' });
    } catch (error) {
        const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id]);
        res.render('cliente/perfil', { cliente, error: 'Erro ao atualizar perfil.' });
    }
});

// ==========================================
// AGENDAMENTO (requer login do cliente)
// ==========================================

app.get('/agendar', clienteLoginRequired, async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos WHERE ativo = 1');
    const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id]);
    res.render('agendar', { procedimentos, cliente });
});

app.post('/agendar', clienteLoginRequired, async (req, res) => {
    const { procedimento_id, data_hora } = req.body;
    const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.session.cliente_id]);
    try {
        await db.query(
            'INSERT INTO agendamentos (cliente_id, procedimento_id, cliente_nome, cliente_telefone, data_hora, status) VALUES (?, ?, ?, ?, ?, "Pendente")',
            [cliente.id, procedimento_id, cliente.nome_completo, cliente.telefone, data_hora]
        );
        const [procedimentos] = await db.query('SELECT * FROM procedimentos WHERE ativo = 1');
        res.render('agendar', { success: 'Agendamento realizado com sucesso! Aguarde nosso contato.', procedimentos, cliente });
    } catch (error) {
        const [procedimentos] = await db.query('SELECT * FROM procedimentos WHERE ativo = 1');
        res.render('agendar', { error: 'Erro ao agendar. Tente novamente.', procedimentos, cliente });
    }
});

// ==========================================
// CONSULTA E CANCELAMENTO DO CLIENTE
// ==========================================

app.get('/consultar', clienteLoginRequired, async (req, res) => {
    const [agendamentos] = await db.query(`
        SELECT a.id, a.status, a.data_hora, p.nome AS procedimento_nome
        FROM agendamentos a
        JOIN procedimentos p ON a.procedimento_id = p.id
        WHERE a.cliente_id = ?
        ORDER BY a.data_hora DESC
    `, [req.session.cliente_id]);

    agendamentos.forEach(a => {
        a.data_formatada = new Date(a.data_hora).toLocaleString('pt-BR');
    });
    res.render('consultar', { agendamentos });
});

app.post('/consultar/cancelar/:id', clienteLoginRequired, async (req, res) => {
    // garante que o agendamento pertence a este cliente e está pendente
    const [[agendamento]] = await db.query(
        'SELECT id FROM agendamentos WHERE id = ? AND cliente_id = ? AND status = "Pendente"',
        [req.params.id, req.session.cliente_id]
    );
    if (!agendamento) {
        return res.redirect('/consultar');
    }
    await db.query('UPDATE agendamentos SET status = "Cancelado" WHERE id = ?', [req.params.id]);
    res.redirect('/consultar');
});

// ==========================================
// AUTENTICAÇÃO DO ADMIN
// ==========================================

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const [users] = await db.query(
        'SELECT * FROM usuarios WHERE username = ? AND password = ?',
        [username, password]
    );
    if (users.length > 0) {
        req.session.user_id = users[0].id;
        req.session.user_name = users[0].nome_completo;
        return res.redirect('/admin');
    }
    res.render('login', { error: 'Usuário ou senha inválidos.' });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ==========================================
// ROTAS ADMINISTRATIVAS
// ==========================================

app.get('/admin', loginRequired, async (req, res) => {
    try {
        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM agendamentos');
        const [[{ pendentes }]] = await db.query('SELECT COUNT(*) as pendentes FROM agendamentos WHERE status = "Pendente"');
        const [[{ realizados }]] = await db.query('SELECT COUNT(*) as realizados FROM agendamentos WHERE status = "Realizado"');
        const [graficoDados] = await db.query(`
            SELECT p.nome as procedimento, COUNT(a.id) as quantidade
            FROM procedimentos p
            LEFT JOIN agendamentos a ON p.id = a.procedimento_id
            WHERE p.ativo = 1
            GROUP BY p.id, p.nome
        `);
        res.render('admin/dashboard', { total, pendentes, realizados, graficoDados: JSON.stringify(graficoDados) });
    } catch (error) {
        res.render('admin/dashboard', { error: 'Erro ao carregar indicadores.' });
    }
});

app.get('/admin/procedimentos', loginRequired, async (req, res) => {
    const [procedimentos] = await db.query('SELECT * FROM procedimentos ORDER BY ativo DESC, id ASC');
    res.render('admin/procedimentos', { procedimentos });
});

app.post('/admin/procedimentos/salvar', loginRequired, async (req, res) => {
    const { id, nome, descricao, duracao_minutos, preco } = req.body;
    try {
        if (id && id.trim() !== '') {
            await db.query(
                'UPDATE procedimentos SET nome=?, descricao=?, duracao_minutos=?, preco=? WHERE id=?',
                [nome, descricao, duracao_minutos, preco, id]
            );
        } else {
            await db.query(
                'INSERT INTO procedimentos (nome, descricao, duracao_minutos, preco) VALUES (?, ?, ?, ?)',
                [nome, descricao, duracao_minutos, preco]
            );
        }
        res.redirect('/admin/procedimentos');
    } catch (error) {
        const [procedimentos] = await db.query('SELECT * FROM procedimentos ORDER BY ativo DESC, id ASC');
        res.render('admin/procedimentos', { error: 'Erro ao salvar procedimento.', procedimentos });
    }
});

app.post('/admin/procedimentos/excluir/:id', loginRequired, async (req, res) => {
    await db.query('UPDATE procedimentos SET ativo = 0 WHERE id = ?', [req.params.id]);
    res.redirect('/admin/procedimentos');
});

app.post('/admin/procedimentos/reativar/:id', loginRequired, async (req, res) => {
    await db.query('UPDATE procedimentos SET ativo = 1 WHERE id = ?', [req.params.id]);
    res.redirect('/admin/procedimentos');
});

app.get('/admin/agendamentos', loginRequired, async (req, res) => {
    const [agendamentos] = await db.query(`
        SELECT a.id, a.cliente_nome, a.cliente_telefone, a.data_hora, a.status, p.nome AS procedimento_nome
        FROM agendamentos a
        JOIN procedimentos p ON a.procedimento_id = p.id
        ORDER BY a.data_hora DESC
    `);
    agendamentos.forEach(a => {
        a.data_formatada = new Date(a.data_hora).toLocaleString('pt-BR');
    });
    res.render('admin/agendamentos', { agendamentos });
});

app.post('/admin/agendamentos/status/:id', loginRequired, async (req, res) => {
    const { status } = req.body;
    await db.query('UPDATE agendamentos SET status = ? WHERE id = ?', [status, req.params.id]);
    res.redirect('/admin/agendamentos');
});

app.post('/admin/agendamentos/cancelar/:id', loginRequired, async (req, res) => {
    await db.query('UPDATE agendamentos SET status = "Cancelado" WHERE id = ?', [req.params.id]);
    res.redirect('/admin/agendamentos');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});