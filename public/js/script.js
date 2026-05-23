// Funções do Modal de Produtos (ENTREGA 6) 

function abrirModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Abre o modal para um NOVO produto
function abrirModalNovo() {
    const form = document.getElementById('form-produto');
    form.action = '/produtos/novo'; // Rota de criação
    
    document.getElementById('modal-titulo').innerText = 'Cadastrar Novo Produto';
    document.getElementById('produto-id').value = '';
    document.getElementById('nome').value = '';
    document.getElementById('variacao').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('estoque_minimo').value = '1';
    
    abrirModal('modal-produto');
}

// Abre o modal para EDITAR um produto existente
function abrirModalEditar(id, nome, variacao, descricao, estoque_minimo) {
    const form = document.getElementById('form-produto');
    form.action = `/produtos/editar/${id}`; // Rota de edição
    
    document.getElementById('modal-titulo').innerText = 'Editar Produto';
    document.getElementById('produto-id').value = id;
    document.getElementById('nome').value = nome;
    document.getElementById('variacao').value = variacao;
    document.getElementById('descricao').value = descricao;
    document.getElementById('estoque_minimo').value = estoque_minimo;
    
    abrirModal('modal-produto');
}

// Fecha o modal se o usuário clicar fora do conteúdo
window.onclick = function(event) {
    const modal = document.getElementById('modal-produto');
    if (event.target == modal) {
        fecharModal('modal-produto');
    }
}

//  Validação de dados (exemplo simples, o 'required' do HTML já faz a maior parte)
document.getElementById('form-produto')?.addEventListener('submit', function(e) {
    const nome = document.getElementById('nome').value;
    const variacao = document.getElementById('variacao').value;
    
    if (nome.trim() === '' || variacao.trim() === '') {
        e.preventDefault(); // Impede o envio do formulário
        alert('Erro: Os campos "Nome" e "Variação" não podem estar vazios.');
    }
});