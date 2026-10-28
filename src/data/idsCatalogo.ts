// Só os ids do catálogo, para telas que precisam saber se um exercício existe
// sem carregar todo o conteúdo (catalogo.test.ts confere que esta lista bate com o catálogo).
export const IDS_CATALOGO: ReadonlySet<string> = new Set([
  "supino-reto-barra", "supino-inclinado-halteres", "crucifixo-halteres", "crucifixo-maquina", "flexao", "crossover-polia",
  "puxada-frente", "remada-curvada-barra", "remada-baixa", "barra-fixa", "remada-unilateral", "levantamento-terra",
  "hiperextensao-lombar", "encolhimento-barra", "face-pull", "abertura-elastico",
  "desenvolvimento-halteres", "elevacao-lateral", "elevacao-frontal", "crucifixo-inverso", "remada-alta",
  "rosca-direta-barra", "rosca-martelo", "rosca-alternada", "rosca-scott", "triceps-polia", "triceps-frances",
  "mergulho-paralelas", "supino-fechado",
  "agachamento-livre", "leg-press", "mesa-flexora", "cadeira-extensora", "stiff", "elevacao-pelvica", "afundo-halteres",
  "panturrilha-em-pe", "panturrilha-sentado", "agachamento-goblet", "terra-unilateral-kettlebell", "ponte-gluteo",
  "agachamento-peso-corporal", "cadeira-abdutora", "cadeira-adutora", "agachamento-smith", "swing-kettlebell",
  "prancha", "abdominal-crunch", "elevacao-pernas-barra", "giro-russo", "escalador",
]);
