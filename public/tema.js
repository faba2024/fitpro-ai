// Aplica o tema salvo antes de desenhar a página (evita piscar). Arquivo externo por causa da CSP.
try {
  var t = localStorage.getItem("fitpro:tema");
  if (t === "claro" || t === "escuro") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
