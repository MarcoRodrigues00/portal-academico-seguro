import {
  CourseLevel,
  MaterialType,
  PrismaClient,
  SubjectContentType,
} from '@prisma/client';

const prisma = new PrismaClient();

// ── Demo user ──────────────────────────────────────────────────────────────
// Marco Rodrigues — usuário real já no banco, criado no primeiro login via Keycloak
const DEMO_KEYCLOAK_ID = '1c74eecd-e24f-47be-a1f0-ffa59f0eb8cb';
const DEMO_NAME        = 'Marco Rodrigues';
const DEMO_EMAIL       = 'marco.vrodrigues@hotmail.com';

// ── Helpers ────────────────────────────────────────────────────────────────

function d(iso: string): Date {
  return new Date(iso);
}

// Dias de aula por disciplina (08 aulas entre fev e abr/2026)
function lessonDates(pattern: 'mon-wed' | 'tue-thu' | 'wed-fri'): Date[] {
  const schedule: Record<typeof pattern, string[]> = {
    'mon-wed': ['2026-02-09','2026-02-23','2026-03-09','2026-03-23','2026-03-30','2026-04-06','2026-04-13','2026-04-20'],
    'tue-thu': ['2026-02-10','2026-02-24','2026-03-10','2026-03-24','2026-03-31','2026-04-07','2026-04-14','2026-04-21'],
    'wed-fri': ['2026-02-11','2026-02-25','2026-03-11','2026-03-25','2026-04-01','2026-04-08','2026-04-15','2026-04-22'],
  };
  return schedule[pattern].map(s => d(s));
}

async function main() {
  console.log('Iniciando seed…\n');

  // ── 1. Demo user ───────────────────────────────────────────────────────────

  const demoUser = await prisma.user.upsert({
    where:  { keycloakId: DEMO_KEYCLOAK_ID },
    update: {},
    create: { keycloakId: DEMO_KEYCLOAK_ID, name: DEMO_NAME, email: DEMO_EMAIL },
    select: { id: true },
  });
  console.log(`✓ Usuário demo: ${demoUser.id}`);

  // ── 2. Cursos públicos ─────────────────────────────────────────────────────

  const courseDefs = [
    {
      title:          'Introdução à Programação',
      description:    'Aprenda os fundamentos do pensamento computacional e da programação. Cobre lógica, algoritmos, estruturas de controle e resolução de problemas com exemplos em Python.',
      level:          CourseLevel.BEGINNER,
      estimatedHours: 8,
      instructorName: 'Prof. Carlos Henrique',
      isPublic:       true,
    },
    {
      title:          'Desenvolvimento Web com HTML e CSS',
      description:    'Construa páginas web modernas do zero. HTML semântico, CSS profissional, layouts responsivos com Flexbox e Grid, e boas práticas de organização.',
      level:          CourseLevel.BEGINNER,
      estimatedHours: 10,
      instructorName: 'Profa. Ana Lima',
      isPublic:       true,
    },
    {
      title:          'Banco de Dados Relacional',
      description:    'Modelagem de dados, normalização e domínio de SQL com PostgreSQL. Do diagrama ER até consultas avançadas com JOIN, índices e performance.',
      level:          CourseLevel.INTERMEDIATE,
      estimatedHours: 12,
      instructorName: 'Prof. João Paulo Silva',
      isPublic:       true,
    },
  ];

  const courseIds: Record<string, string> = {};

  for (const def of courseDefs) {
    const existing = await prisma.course.findFirst({ where: { title: def.title } });
    let courseId: string;
    if (existing) {
      await prisma.course.update({ where: { id: existing.id }, data: def });
      courseId = existing.id;
    } else {
      const created = await prisma.course.create({ data: def });
      courseId = created.id;
    }
    courseIds[def.title] = courseId;
    console.log(`✓ Curso: ${def.title}`);
  }

  // ── 3. Limpar dados derivados dos cursos ───────────────────────────────────

  const allCourseIds = Object.values(courseIds);

  // QA posts não têm unique → delete e recria
  await prisma.courseDiscussionPost.deleteMany({ where: { courseId: { in: allCourseIds } } });
  // Materials e Questions podem referenciar modules, mas courseId é a ancora principal
  await prisma.courseMaterial.deleteMany({ where: { courseId: { in: allCourseIds } } });
  await prisma.courseQuestion.deleteMany({ where: { courseId: { in: allCourseIds } } });
  // Modules: cascade deleta CourseProgress
  await prisma.courseModule.deleteMany({ where: { courseId: { in: allCourseIds } } });

  // ── 4. Módulos por curso ───────────────────────────────────────────────────

  type ModuleDef = {
    courseTitle: string;
    modules: { title: string; description: string; order: number; durationMin: number; videoUrl: string }[];
  };

  const moduleDefs: ModuleDef[] = [
    {
      courseTitle: 'Introdução à Programação',
      modules: [
        { order: 1, durationMin: 12, title: 'O que é programar?',             description: 'Algoritmos, máquina de estados e o papel do programador.',           videoUrl: '/media/courses/intro-prog/aula-01.mp4' },
        { order: 2, durationMin: 18, title: 'Variáveis, tipos e operadores',   description: 'Tipos primitivos, atribuição, aritméticos e lógicos.',               videoUrl: '/media/courses/intro-prog/aula-02.mp4' },
        { order: 3, durationMin: 22, title: 'Condicionais e loops',            description: 'if/else, while, for — com exemplos e exercícios guiados.',           videoUrl: '/media/courses/intro-prog/aula-03.mp4' },
        { order: 4, durationMin: 19, title: 'Funções: organização e reuso',    description: 'Parâmetros, retorno e escopo de variáveis.',                         videoUrl: '/media/courses/intro-prog/aula-04.mp4' },
      ],
    },
    {
      courseTitle: 'Desenvolvimento Web com HTML e CSS',
      modules: [
        { order: 1, durationMin: 20, title: 'Estrutura HTML e semântica',      description: 'Tags, atributos, document outline e acessibilidade.',                videoUrl: '/media/courses/web-html-css/aula-01.mp4' },
        { order: 2, durationMin: 25, title: 'CSS: seletores, cores e tipografia', description: 'Box model, herança, cascade e especificidade.',                   videoUrl: '/media/courses/web-html-css/aula-02.mp4' },
        { order: 3, durationMin: 30, title: 'Layouts com Flexbox',             description: 'Eixos, alinhamento, wrapping e casos reais de uso.',                 videoUrl: '/media/courses/web-html-css/aula-03.mp4' },
        { order: 4, durationMin: 28, title: 'Grid Layout e responsividade',    description: 'Grid template, auto-fit, media queries e mobile-first.',             videoUrl: '/media/courses/web-html-css/aula-04.mp4' },
      ],
    },
    {
      courseTitle: 'Banco de Dados Relacional',
      modules: [
        { order: 1, durationMin: 18, title: 'O que são bancos de dados?',      description: 'SGBD, modelos de dados e por que usar PostgreSQL.',                  videoUrl: '/media/courses/banco-dados/aula-01.mp4' },
        { order: 2, durationMin: 24, title: 'Modelagem ER e normalização',     description: 'Entidades, relacionamentos, 1FN, 2FN e 3FN na prática.',             videoUrl: '/media/courses/banco-dados/aula-02.mp4' },
        { order: 3, durationMin: 30, title: 'SELECT, INSERT, UPDATE, DELETE',  description: 'CRUD completo com filtros, ordenação e agregações.',                 videoUrl: '/media/courses/banco-dados/aula-03.mp4' },
        { order: 4, durationMin: 26, title: 'JOIN, índices e performance',     description: 'INNER/LEFT JOIN, EXPLAIN ANALYZE e índices B-tree.',                 videoUrl: '/media/courses/banco-dados/aula-04.mp4' },
      ],
    },
  ];

  const moduleIds: Record<string, string[]> = {}; // courseTitle → [moduleId, ...]

  for (const def of moduleDefs) {
    const cid = courseIds[def.courseTitle];
    const created: string[] = [];
    for (const m of def.modules) {
      const mod = await prisma.courseModule.create({
        data: { courseId: cid, ...m },
        select: { id: true },
      });
      created.push(mod.id);
    }
    moduleIds[def.courseTitle] = created;
    console.log(`  ✓ ${def.modules.length} módulos → ${def.courseTitle}`);
  }

  // ── 5. Materiais por curso ─────────────────────────────────────────────────

  type MaterialDef = {
    courseTitle: string;
    items: { title: string; type: MaterialType; filePath: string; isPublic: boolean; moduleIndex?: number }[];
  };

  const materialDefs: MaterialDef[] = [
    {
      courseTitle: 'Introdução à Programação',
      items: [
        { title: 'Slides — Lógica e Algoritmos',       type: MaterialType.PDF,       filePath: 'courses/intro-prog/slides-aula-01.pdf',   isPublic: true,  moduleIndex: 0 },
        { title: 'Cheat Sheet — Python Básico',        type: MaterialType.REFERENCE,  filePath: 'courses/intro-prog/cheatsheet-python.pdf', isPublic: true,  moduleIndex: 1 },
        { title: 'Exercícios resolvidos — Módulo 1',   type: MaterialType.CODE,       filePath: 'courses/intro-prog/exercicios-mod1.zip',   isPublic: false, moduleIndex: 2 },
        { title: 'Slides — Funções e Escopo',          type: MaterialType.PDF,        filePath: 'courses/intro-prog/slides-aula-04.pdf',   isPublic: false, moduleIndex: 3 },
      ],
    },
    {
      courseTitle: 'Desenvolvimento Web com HTML e CSS',
      items: [
        { title: 'Slides — HTML Semântico',            type: MaterialType.PDF,       filePath: 'courses/web-html-css/slides-html.pdf',      isPublic: true,  moduleIndex: 0 },
        { title: 'Referência Rápida — CSS Properties', type: MaterialType.REFERENCE,  filePath: 'courses/web-html-css/css-reference.pdf',    isPublic: true,  moduleIndex: 1 },
        { title: 'Projeto Flexbox — Código Fonte',     type: MaterialType.CODE,       filePath: 'courses/web-html-css/projeto-flexbox.zip',  isPublic: false, moduleIndex: 2 },
        { title: 'Template Responsivo Pronto',         type: MaterialType.CODE,       filePath: 'courses/web-html-css/template-grid.zip',    isPublic: false, moduleIndex: 3 },
      ],
    },
    {
      courseTitle: 'Banco de Dados Relacional',
      items: [
        { title: 'Slides — Modelagem ER',              type: MaterialType.PDF,       filePath: 'courses/banco-dados/slides-modelagem.pdf',  isPublic: true,  moduleIndex: 1 },
        { title: 'Scripts SQL — CRUD Completo',        type: MaterialType.CODE,       filePath: 'courses/banco-dados/crud-postgresql.sql',   isPublic: false, moduleIndex: 2 },
        { title: 'Referência — Funções SQL',           type: MaterialType.REFERENCE,  filePath: 'courses/banco-dados/sql-functions.pdf',     isPublic: true,  moduleIndex: 2 },
        { title: 'Exercícios de JOIN',                 type: MaterialType.CODE,       filePath: 'courses/banco-dados/exercicios-join.sql',   isPublic: false, moduleIndex: 3 },
      ],
    },
  ];

  for (const def of materialDefs) {
    const cid = courseIds[def.courseTitle];
    const mids = moduleIds[def.courseTitle];
    for (const item of def.items) {
      const { moduleIndex, ...rest } = item;
      await prisma.courseMaterial.create({
        data: {
          courseId: cid,
          moduleId: moduleIndex !== undefined ? mids[moduleIndex] : null,
          ...rest,
        },
      });
    }
    console.log(`  ✓ ${def.items.length} materiais → ${def.courseTitle}`);
  }

  // ── 6. Questões por curso ──────────────────────────────────────────────────

  type QuestionDef = {
    courseTitle: string;
    questions: { text: string; options: string[]; correctAnswer: number; explanation: string; order: number; moduleIndex?: number }[];
  };

  const questionDefs: QuestionDef[] = [
    {
      courseTitle: 'Introdução à Programação',
      questions: [
        { order: 1, moduleIndex: 1, text: 'x = 5; x = x + 3. Qual o valor final de x?',              options: ['5', '3', '8', 'Erro de sintaxe'], correctAnswer: 2, explanation: 'x começa com 5, depois recebe 5 + 3 = 8. Atribuição sobrescreve o valor anterior.' },
        { order: 2, moduleIndex: 1, text: 'O que é uma função em programação?',                        options: ['Uma variável que guarda números', 'Um bloco reutilizável com nome definido', 'Uma instrução de repetição', 'Um operador lógico'], correctAnswer: 1, explanation: 'Funções encapsulam lógica reutilizável. São chamadas pelo nome, recebem parâmetros e retornam valores.' },
        { order: 3, moduleIndex: 2, text: 'Qual estrutura repete enquanto uma condição for verdadeira?', options: ['if', 'for', 'while', 'def'], correctAnswer: 2, explanation: 'O while testa a condição antes de cada iteração e repete até que ela se torne falsa.' },
        { order: 4, moduleIndex: 1, text: 'Em Python, qual o tipo de 3.14?',                          options: ['int', 'str', 'float', 'number'], correctAnswer: 2, explanation: '3.14 é ponto flutuante. Em Python o tipo é float.' },
        { order: 5, moduleIndex: 2, text: 'O que acontece com while True: sem break?',                options: ['Executa uma vez', 'Gera erro', 'Loop infinito', 'Pula a execução'], correctAnswer: 2, explanation: 'while True é sempre verdadeiro. Sem break, o loop nunca termina.' },
      ],
    },
    {
      courseTitle: 'Desenvolvimento Web com HTML e CSS',
      questions: [
        { order: 1, moduleIndex: 0, text: 'Qual tag define o título principal de uma página em HTML semântico?', options: ['<title>', '<h1>', '<header>', '<main>'], correctAnswer: 1, explanation: '<h1> define o título principal do conteúdo da página. <title> define o título exibido na aba do navegador.' },
        { order: 2, moduleIndex: 1, text: 'No CSS, qual propriedade define a distância interna de um elemento?', options: ['margin', 'padding', 'border', 'gap'], correctAnswer: 1, explanation: 'padding define o espaço entre o conteúdo e a borda do elemento. margin é o espaço externo.' },
        { order: 3, moduleIndex: 2, text: 'Qual valor de display:flex alinha itens ao longo do eixo principal?', options: ['align-items', 'justify-content', 'flex-wrap', 'flex-direction'], correctAnswer: 1, explanation: 'justify-content distribui os itens ao longo do eixo principal (row = horizontal). align-items cuida do eixo cruzado.' },
        { order: 4, moduleIndex: 3, text: 'Como declarar uma media query para telas abaixo de 768px?',          options: ['@media (max-width: 768px)', '@screen sm', '@breakpoint mobile', 'display: mobile'], correctAnswer: 0, explanation: '@media (max-width: 768px) aplica estilos apenas quando a largura da viewport for no máximo 768px.' },
        { order: 5, moduleIndex: 1, text: 'Qual a ordem correta de especificidade CSS?',                        options: ['ID > class > element', 'class > ID > element', 'element > class > ID', 'Todas têm igual peso'], correctAnswer: 0, explanation: 'ID tem maior especificidade (0,1,0), seguido de class/attribute (0,0,1) e element/tag (0,0,0).' },
      ],
    },
    {
      courseTitle: 'Banco de Dados Relacional',
      questions: [
        { order: 1, moduleIndex: 0, text: 'O que é uma chave primária (PRIMARY KEY)?',                            options: ['Um campo que pode se repetir', 'Um identificador único de cada linha', 'Um índice opcional', 'Uma coluna de texto'], correctAnswer: 1, explanation: 'A chave primária identifica cada linha de forma única na tabela. Ela nunca pode ser NULL e não se repete.' },
        { order: 2, moduleIndex: 1, text: 'Qual forma normal elimina dependências transitivas?',                 options: ['1FN', '2FN', '3FN', '4FN'], correctAnswer: 2, explanation: 'A Terceira Forma Normal (3FN) exige que colunas não-chave dependam apenas da chave primária, eliminando dependências transitivas.' },
        { order: 3, moduleIndex: 2, text: 'Qual cláusula filtra linhas APÓS agrupamento?',                       options: ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'], correctAnswer: 1, explanation: 'HAVING filtra os grupos produzidos pelo GROUP BY. WHERE filtra linhas individuais antes do agrupamento.' },
        { order: 4, moduleIndex: 3, text: 'O que faz um INNER JOIN?',                                            options: ['Retorna todas as linhas da tabela esquerda', 'Retorna apenas linhas com correspondência em ambas as tabelas', 'Retorna todas as linhas de ambas as tabelas', 'Cria um produto cartesiano sem filtro'], correctAnswer: 1, explanation: 'INNER JOIN retorna apenas as linhas que têm correspondência nas duas tabelas. Linhas sem par são descartadas.' },
        { order: 5, moduleIndex: 3, text: 'Para que serve o comando EXPLAIN ANALYZE?',                           options: ['Deletar registros', 'Mostrar o plano e tempo real de execução de uma query', 'Criar índices automaticamente', 'Listar todas as tabelas'], correctAnswer: 1, explanation: 'EXPLAIN ANALYZE executa a query e exibe o plano de execução com tempos reais, útil para diagnosticar lentidão.' },
      ],
    },
  ];

  for (const def of questionDefs) {
    const cid = courseIds[def.courseTitle];
    const mids = moduleIds[def.courseTitle];
    for (const q of def.questions) {
      const { moduleIndex, ...rest } = q;
      await prisma.courseQuestion.create({
        data: {
          courseId: cid,
          moduleId: moduleIndex !== undefined ? mids[moduleIndex] : null,
          options:  rest.options,
          ...rest,
        },
      });
    }
    console.log(`  ✓ ${def.questions.length} questões → ${def.courseTitle}`);
  }

  // ── 7. QA dos cursos ──────────────────────────────────────────────────────

  type QADef = {
    courseTitle: string;
    posts: { question: string; authorName: string; answer?: string }[];
  };

  const qaDefs: QADef[] = [
    {
      courseTitle: 'Introdução à Programação',
      posts: [
        { question: 'Preciso de matemática avançada para programar?', authorName: 'Ana R.',   answer: 'Não! Lógica básica e aritmética simples são suficientes. Matemática avançada entra em áreas específicas como IA ou computação gráfica.' },
        { question: 'Qual linguagem aprender primeiro?',              authorName: 'Carlos M.', answer: 'Python: sintaxe simples, comunidade enorme. Os conceitos valem para qualquer linguagem.' },
        { question: 'Como praticar além do curso?',                   authorName: 'Lúcia S.',  answer: 'HackerRank, Beecrowd e Exercism têm desafios graduais. 2–3 exercícios por dia fazem grande diferença.' },
      ],
    },
    {
      courseTitle: 'Desenvolvimento Web com HTML e CSS',
      posts: [
        { question: 'Qual a diferença entre margin e padding?',       authorName: 'Pedro H.',  answer: 'margin é o espaço externo ao elemento (fora da borda). padding é o espaço interno (entre conteúdo e borda).' },
        { question: 'Devo aprender Flexbox ou Grid primeiro?',        authorName: 'Julia S.',  answer: 'Flexbox para layouts lineares (menus, listas, cards). Grid para layouts bidimensionais. Idealmente, ambos — mas Flexbox é o ponto de partida mais comum.' },
        { question: 'CSS Frameworks já não resolvem tudo?',           authorName: 'Rafael T.',  },
      ],
    },
    {
      courseTitle: 'Banco de Dados Relacional',
      posts: [
        { question: 'Quando usar NoSQL ao invés de SQL?',             authorName: 'Marina C.', answer: 'NoSQL brilha em dados não estruturados, escala horizontal massiva ou esquemas muito dinâmicos. Para a maioria dos sistemas, SQL relacional com boas práticas é mais do que suficiente.' },
        { question: 'O que é N+1 query problem?',                     authorName: 'Diego L.',  answer: 'Ocorre quando, para N registros, você dispara 1 query principal + N queries individuais. A solução é usar JOIN ou carregamento em batch.' },
        { question: 'Índices tornam o INSERT mais lento?',            authorName: 'Carla F.',  answer: 'Sim — cada INSERT precisa atualizar os índices. O trade-off é: mais rápido no SELECT, mais lento no escrita. Indexe apenas colunas que realmente são filtradas em queries frequentes.' },
      ],
    },
  ];

  for (const def of qaDefs) {
    const cid = courseIds[def.courseTitle];
    for (const p of def.posts) {
      await prisma.courseDiscussionPost.create({
        data: {
          courseId:   cid,
          question:   p.question,
          authorName: p.authorName,
          answer:     p.answer ?? null,
        },
      });
    }
    console.log(`  ✓ ${def.posts.length} posts QA → ${def.courseTitle}`);
  }

  // ── 8. Semestre 2026.1 ────────────────────────────────────────────────────

  const semester = await prisma.semester.upsert({
    where:  { name: '2026.1' },
    update: { isActive: true },
    create: {
      name:      '2026.1',
      startDate: d('2026-02-10'),
      endDate:   d('2026-06-27'),
      isActive:  true,
    },
    select: { id: true },
  });
  console.log('\n✓ Semestre 2026.1');

  // ── 9. Disciplinas ────────────────────────────────────────────────────────

  type SubjectDef = {
    code:          string;
    name:          string;
    professorName: string;
    credits:       number;
    schedule:      string;
    room:          string;
    lessonPattern: 'mon-wed' | 'tue-thu' | 'wed-fri';
    lessonTitles:  string[];
    // attendance: índices das aulas em que o aluno FALTOU (0-based)
    absentIndexes: number[];
    grades: { assessmentName: string; score: number; maxScore: number }[];
    contents: { title: string; type: SubjectContentType; filePath?: string; url?: string }[];
  };

  const subjectDefs: SubjectDef[] = [
    {
      code: 'CC101', name: 'Algoritmos e Lógica de Programação',
      professorName: 'Prof. Carlos Henrique',
      credits: 4, schedule: 'Seg/Qua · 19h–21h', room: 'Lab 3',
      lessonPattern: 'mon-wed',
      lessonTitles: [
        'Introdução ao pensamento algorítmico',
        'Variáveis, constantes e tipos de dados',
        'Estruturas condicionais: if/else',
        'Estruturas de repetição: while e for',
        'Vetores e matrizes',
        'Funções e modularização',
        'Recursão e pilha de chamadas',
        'Revisão geral e exercícios',
      ],
      absentIndexes: [6],        // faltou aula 7 → 7/8 = 87,5%
      grades: [
        { assessmentName: 'N1', score: 8.5, maxScore: 10 },
        { assessmentName: 'N2', score: 9.0, maxScore: 10 },
        { assessmentName: 'Trabalho Final', score: 8.0, maxScore: 10 },
      ],
      contents: [
        { title: 'Slides — Aula 1: Pensamento Algorítmico',  type: SubjectContentType.SLIDE, filePath: 'subjects/cc101/slides-aula-01.pdf'   },
        { title: 'Exercícios — Estruturas de Controle',       type: SubjectContentType.PDF,   filePath: 'subjects/cc101/exercicios-mod2.pdf'   },
        { title: 'Gravação — Aula 4: Laços e Repetição',     type: SubjectContentType.VIDEO, url: '/media/subjects/cc101/aula-04.mp4' },
        { title: 'Material Extra — Pseudocódigo vs Python',  type: SubjectContentType.LINK,  url: 'https://pt.wikipedia.org/wiki/Pseudoc%C3%B3digo' },
      ],
    },
    {
      code: 'CC201', name: 'Estruturas de Dados',
      professorName: 'Profa. Beatriz Santos',
      credits: 4, schedule: 'Ter/Qui · 19h–21h', room: 'Lab 2',
      lessonPattern: 'tue-thu',
      lessonTitles: [
        'Listas encadeadas simples',
        'Listas duplamente encadeadas',
        'Pilhas (Stack) — conceito e implementação',
        'Filas (Queue) — conceito e implementação',
        'Árvores binárias',
        'Árvores de busca binária (BST)',
        'Grafos — representação e percurso',
        'Hashing e tabelas de dispersão',
      ],
      absentIndexes: [2, 6],     // faltou aulas 3 e 7 → 6/8 = 75%
      grades: [
        { assessmentName: 'N1', score: 7.0, maxScore: 10 },
        { assessmentName: 'N2', score: 6.5, maxScore: 10 },
        { assessmentName: 'Trabalho Final', score: 7.5, maxScore: 10 },
      ],
      contents: [
        { title: 'Slides — Listas Encadeadas',   type: SubjectContentType.SLIDE, filePath: 'subjects/cc201/slides-listas.pdf'   },
        { title: 'Código — Pilha em Python',     type: SubjectContentType.PDF,   filePath: 'subjects/cc201/pilha-python.pdf'   },
        { title: 'Gravação — Árvores BST',       type: SubjectContentType.VIDEO, url: '/media/subjects/cc201/aula-bst.mp4'     },
      ],
    },
    {
      code: 'CC301', name: 'Banco de Dados I',
      professorName: 'Prof. João Paulo Silva',
      credits: 4, schedule: 'Seg/Qua · 21h–23h', room: 'Lab 1',
      lessonPattern: 'mon-wed',
      lessonTitles: [
        'Introdução a SGBDs e modelos de dados',
        'Modelagem Entidade-Relacionamento',
        'Normalização: 1FN, 2FN e 3FN',
        'DDL: CREATE TABLE, ALTER, DROP',
        'DML: INSERT, UPDATE, DELETE',
        'Consultas SELECT e filtros WHERE',
        'Funções de agregação e GROUP BY',
        'JOINs: INNER, LEFT, RIGHT',
      ],
      absentIndexes: [1, 4, 7],  // faltou aulas 2, 5, 8 → 5/8 = 62,5%
      grades: [
        { assessmentName: 'N1', score: 5.0, maxScore: 10 },
        { assessmentName: 'N2', score: 6.0, maxScore: 10 },
      ],
      contents: [
        { title: 'Slides — Modelagem ER',           type: SubjectContentType.SLIDE, filePath: 'subjects/cc301/slides-er.pdf'          },
        { title: 'Scripts SQL — DDL e DML',         type: SubjectContentType.PDF,   filePath: 'subjects/cc301/scripts-ddl-dml.pdf'    },
        { title: 'Referência — Funções PostgreSQL', type: SubjectContentType.LINK,  url: 'https://www.postgresql.org/docs/current/functions.html' },
      ],
    },
    {
      code: 'CC401', name: 'Engenharia de Software',
      professorName: 'Profa. Maria Fernanda Costa',
      credits: 4, schedule: 'Ter/Qui · 21h–23h', room: 'Sala 5',
      lessonPattern: 'tue-thu',
      lessonTitles: [
        'Processos de software e ciclo de vida',
        'Requisitos funcionais e não-funcionais',
        'UML: diagramas de caso de uso',
        'UML: diagramas de classe',
        'Padrões de projeto — Criacionais',
        'Padrões de projeto — Estruturais',
        'Testes: unitários, integração e E2E',
        'Entrega contínua e DevOps',
      ],
      absentIndexes: [], // presença 100%
      grades: [
        { assessmentName: 'N1', score: 9.5, maxScore: 10 },
        { assessmentName: 'N2', score: 9.0, maxScore: 10 },
      ],
      contents: [
        { title: 'Slides — Requisitos e UML',    type: SubjectContentType.SLIDE, filePath: 'subjects/cc401/slides-requisitos.pdf' },
        { title: 'Slides — Padrões de Projeto',  type: SubjectContentType.SLIDE, filePath: 'subjects/cc401/slides-design-patterns.pdf' },
        { title: 'Gravação — TDD na prática',    type: SubjectContentType.VIDEO, url: '/media/subjects/cc401/aula-tdd.mp4'       },
        { title: 'Material Extra — Manifesto Ágil', type: SubjectContentType.LINK, url: 'https://agilemanifesto.org/iso/ptbr/manifesto.html' },
      ],
    },
    {
      code: 'CC501', name: 'Redes de Computadores',
      professorName: 'Prof. Ricardo Alves',
      credits: 4, schedule: 'Qua/Sex · 19h–21h', room: 'Sala 3',
      lessonPattern: 'wed-fri',
      lessonTitles: [
        'Modelo OSI e TCP/IP',
        'Camada física e enlace',
        'Endereçamento IP e sub-redes',
        'Protocolos de roteamento',
        'Camada de transporte: TCP e UDP',
        'DNS, DHCP e serviços de rede',
        'Segurança: firewalls e VPN',
        'Redes sem fio e protocolos 802.11',
      ],
      absentIndexes: [0, 2, 4, 7], // faltou aulas 1, 3, 5, 8 → 4/8 = 50%
      grades: [],
      contents: [
        { title: 'Slides — Modelo OSI',        type: SubjectContentType.SLIDE, filePath: 'subjects/cc501/slides-osi.pdf'     },
        { title: 'Referência — RFCs relevantes', type: SubjectContentType.LINK, url: 'https://www.rfc-editor.org/'           },
      ],
    },
  ];

  const subjectIds: Record<string, string> = {}; // code → id

  for (const def of subjectDefs) {
    const { lessonPattern, lessonTitles, absentIndexes, grades, contents, ...subjectData } = def;
    const sub = await prisma.subject.upsert({
      where:  { semesterId_code: { semesterId: semester.id, code: def.code } },
      update: subjectData,
      create: { semesterId: semester.id, ...subjectData },
      select: { id: true },
    });
    subjectIds[def.code] = sub.id;
    console.log(`✓ Disciplina: ${def.code} — ${def.name}`);
  }

  // ── 10. Matrículas do aluno demo ──────────────────────────────────────────

  for (const sid of Object.values(subjectIds)) {
    await prisma.subjectEnrollment.upsert({
      where:  { userId_subjectId: { userId: demoUser.id, subjectId: sid } },
      update: {},
      create: { userId: demoUser.id, subjectId: sid },
    });
  }
  console.log(`\n✓ ${Object.keys(subjectIds).length} matrículas criadas para ${DEMO_NAME}`);

  // ── 11. Aulas e presenças ─────────────────────────────────────────────────

  // Limpa lições existentes (cascade deleta attendances)
  await prisma.lesson.deleteMany({ where: { subjectId: { in: Object.values(subjectIds) } } });

  for (const def of subjectDefs) {
    const subId = subjectIds[def.code];
    const dates  = lessonDates(def.lessonPattern);

    for (let i = 0; i < def.lessonTitles.length; i++) {
      const lesson = await prisma.lesson.create({
        data: {
          subjectId:   subId,
          title:       def.lessonTitles[i],
          date:        dates[i],
          description: `Aula ${i + 1} de ${def.name}`,
        },
        select: { id: true },
      });

      // Registra presença apenas para aulas já ocorridas (antes de hoje)
      if (dates[i] < new Date()) {
        await prisma.attendance.create({
          data: {
            lessonId: lesson.id,
            userId:   demoUser.id,
            present:  !def.absentIndexes.includes(i),
          },
        });
      }
    }
    const attended = def.lessonTitles.length - def.absentIndexes.length;
    console.log(`  ✓ ${def.lessonTitles.length} aulas | presença ${attended}/${def.lessonTitles.length} → ${def.code}`);
  }

  // ── 12. Notas ─────────────────────────────────────────────────────────────

  for (const def of subjectDefs) {
    const subId = subjectIds[def.code];
    for (const g of def.grades) {
      await prisma.grade.upsert({
        where:  { userId_subjectId_assessmentName: { userId: demoUser.id, subjectId: subId, assessmentName: g.assessmentName } },
        update: { score: g.score, maxScore: g.maxScore },
        create: { userId: demoUser.id, subjectId: subId, ...g },
      });
    }
    if (def.grades.length > 0) {
      console.log(`  ✓ ${def.grades.length} nota(s) → ${def.code}`);
    }
  }

  // ── 13. Conteúdos das disciplinas ─────────────────────────────────────────

  await prisma.subjectContent.deleteMany({ where: { subjectId: { in: Object.values(subjectIds) } } });

  for (const def of subjectDefs) {
    const subId = subjectIds[def.code];
    for (const c of def.contents) {
      await prisma.subjectContent.create({
        data: {
          subjectId:     subId,
          postedByUserId: demoUser.id,
          title:         c.title,
          type:          c.type,
          filePath:      c.filePath ?? null,
          url:           c.url ?? null,
        },
      });
    }
    console.log(`  ✓ ${def.contents.length} conteúdo(s) → ${def.code}`);
  }

  // ── Resumo ─────────────────────────────────────────────────────────────────

  console.log('\n──────────────────────────────────────────');
  console.log('Seed concluído com sucesso!');
  console.log(`  Usuário demo : ${DEMO_NAME} (${DEMO_EMAIL})`);
  console.log(`  Cursos       : ${Object.keys(courseIds).length} (com módulos, materiais, questões e QA)`);
  console.log(`  Semestre     : 2026.1`);
  console.log(`  Disciplinas  : ${Object.keys(subjectIds).length}`);
  console.log(`  Matrículas   : ${Object.keys(subjectIds).length}`);
  console.log('──────────────────────────────────────────\n');
}

main()
  .catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
