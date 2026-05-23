// ==========================================
// MODAL - PROCEDIMENTOS (Admin)
// ==========================================

function abrirModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function fecharModal(modalId) {
    if (modalId) {
        const el = document.getElementById(modalId);
        if (el) el.style.display = 'none';
    } else {
        // fallback: fecha qualquer modal aberto
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }
}

// Abre o modal para um NOVO procedimento
function abrirModalNovo() {
    document.getElementById('modal-titulo').innerText = 'Novo Procedimento';
    document.getElementById('procedimento-id').value = '';
    document.getElementById('nome').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('duracao_minutos').value = '';
    document.getElementById('preco').value = '';
    abrirModal('modal-procedimento');
}

// Abre o modal para EDITAR um procedimento existente
// Ordem dos parâmetros: (id, nome, descricao, duracao, preco)
function abrirModalEditar(id, nome, descricao, duracao, preco) {
    document.getElementById('modal-titulo').innerText = 'Editar Procedimento';
    document.getElementById('procedimento-id').value = id;
    document.getElementById('nome').value = nome;
    document.getElementById('descricao').value = descricao;
    document.getElementById('duracao_minutos').value = duracao;
    document.getElementById('preco').value = preco;
    abrirModal('modal-procedimento');
}

// Fecha o modal ao clicar fora do conteúdo
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}