const express = require('express');
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require("socket.io");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT
};

async function getDBConnection() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        return connection;
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados:', err.stack);
        process.exit(1);
    }
}

app.get('/', async (req, res) => {
    const connection = await getDBConnection();
    const [tarefas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = FALSE ORDER BY prazo ASC, urgencia DESC');
    const [concluidas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = TRUE ORDER BY prazo DESC');
    res.render('index', { tarefas, concluidas });
    connection.end();
});

app.post('/adicionar', async (req, res) => {
    const { servico, prazo, urgencia, descricao } = req.body;
    const connection = await getDBConnection();
    await connection.execute('INSERT INTO tarefas (servico, prazo, urgencia, descricao) VALUES (?, ?, ?, ?)', [servico, prazo, urgencia, descricao]);
    const [tarefas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = FALSE ORDER BY prazo ASC, urgencia DESC');
    io.emit('atualizar_pendentes', tarefas);
    connection.end();
    res.redirect('/');
});

app.post('/concluir/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await getDBConnection();
    await connection.execute('UPDATE tarefas SET concluido = NOT concluido WHERE id = ?', [id]);
    const [tarefas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = FALSE ORDER BY prazo ASC, urgencia DESC');
    const [concluidas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = TRUE ORDER BY prazo DESC');
    io.emit('atualizar_pendentes', tarefas);
    io.emit('atualizar_concluidas', concluidas);
    connection.end();
    res.redirect('/');
});

app.post('/deletar/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await getDBConnection();
    await connection.execute('DELETE FROM tarefas WHERE id = ?', [id]);
    const [tarefas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = FALSE ORDER BY prazo ASC, urgencia DESC');
    const [concluidas] = await connection.execute('SELECT * FROM tarefas WHERE concluido = TRUE ORDER BY prazo DESC');
    io.emit('atualizar_pendentes', tarefas);
    io.emit('atualizar_concluidas', concluidas);
    connection.end();
    res.redirect('/');
});

server.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});