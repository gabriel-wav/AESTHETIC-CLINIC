CREATE DATABASE IF NOT EXISTS clinica_estetica;
USE clinica_estetica;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nome_completo VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS procedimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    duracao_minutos INT NOT NULL,
    preco DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    procedimento_id INT NOT NULL,
    cliente_nome VARCHAR(100) NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    data_hora DATETIME NOT NULL,
    status VARCHAR(20) DEFAULT 'Pendente',
    FOREIGN KEY (procedimento_id) REFERENCES procedimentos(id)
);

-- Inserir usuário administrador padrão (Senha: 123)
INSERT INTO usuarios (username, password, nome_completo) 
VALUES ('admin', '123', 'Administrador da Clínica');

-- Procedimentos Iniciais
INSERT INTO procedimentos (nome, descricao, duracao_minutos, preco) VALUES
('Limpeza de Pele', 'Limpeza profunda com extração de cravos.', 60, 150.00),
('Drenagem Linfática', 'Massagem para reduzir retenção de líquidos.', 50, 120.00),
('Peeling Químico', 'Renovação celular e clareamento de manchas.', 45, 200.00);