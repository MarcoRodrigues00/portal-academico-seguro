import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Layout from '../components/Layout'
import api from '../lib/api'

interface Request {
  id: string | number
  title: string
  description: string
  status: string
  createdAt: string
}

interface FormErrors {
  type?: string
  description?: string
}

// ── Constants ────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'badge-yellow',
  APPROVED:  'badge-green',
  COMPLETED: 'badge-blue',
  REJECTED:  'badge-red',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Em análise',
  APPROVED:  'Aprovado',
  COMPLETED: 'Concluído',
  REJECTED:  'Reprovado',
}

// Stat cards — each is a clickable status filter
const STAT_CARDS = [
  { key: 'ALL',      label: 'Total',      color: '#39ff85', textColor: 'text-[#39ff85]', delta: 'todos os requerimentos'    },
  { key: 'PENDING',  label: 'Em análise', color: '#f0c040', textColor: 'text-[#f0c040]', delta: 'aguardando resposta'        },
  { key: 'RESOLVED', label: 'Resolvidos', color: '#00c8ff', textColor: 'text-[#00c8ff]', delta: 'aprovados ou concluídos'   },
  { key: 'REJECTED', label: 'Reprovados', color: '#ff6070', textColor: 'text-[#ff6070]', delta: 'solicitações negadas'       },
] as const

type FilterKey = typeof STAT_CARDS[number]['key']

const TYPES = [
  'Declaração de Matrícula',
  'Histórico Escolar',
  'Trancamento de Disciplina',
  'Cancelamento de Matrícula',
  'Revisão de Nota',
  'Aproveitamento de Estudos',
  'Outros',
]

const MIN_DESC_LENGTH = 10

// ── Helpers ──────────────────────────────────────────────────────

function normalizeStatus(s: string) {
  return s.toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function shortId(id: string | number) {
  const s = String(id)
  return s.length > 6 ? `#${s.slice(-4).toUpperCase()}` : `#${s}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

// ── Sub-components ───────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[88px_1fr_120px_120px] gap-4 px-5 py-4 border-b border-[#192633]">
      <div className="skeleton h-3 w-12" />
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-44" />
        <div className="skeleton h-2.5 w-64" />
      </div>
      <div className="skeleton h-3 w-20" />
      <div className="skeleton h-4 w-20 rounded-full" />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function RequestsPage() {
  const [requests, setRequests]         = useState<Request[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [type, setType]                 = useState('')
  const [description, setDescription]  = useState('')
  const [formErrors, setFormErrors]     = useState<FormErrors>({})
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [successMsg, setSuccessMsg]     = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterKey>('ALL')
  const [searchQuery, setSearchQuery]   = useState('')
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchRequests() {
    try {
      setError('')
      const res = await api.get<{ requests: Request[] }>('/requests/me')
      setRequests(res.data.requests)
    } catch {
      setError('Erro ao carregar requerimentos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    return () => { if (successTimer.current) clearTimeout(successTimer.current) }
  }, [])

  // Derived counts for stat cards
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: requests.length }
    for (const req of requests) {
      const k = normalizeStatus(req.status)
      c[k] = (c[k] ?? 0) + 1
    }
    c.RESOLVED = (c.APPROVED ?? 0) + (c.COMPLETED ?? 0)
    return c
  }, [requests])

  const filteredRequests = useMemo(() => {
    let list = requests
    if (filterStatus === 'RESOLVED') {
      list = list.filter(r => ['APPROVED', 'COMPLETED'].includes(normalizeStatus(r.status)))
    } else if (filterStatus !== 'ALL') {
      list = list.filter(r => normalizeStatus(r.status) === filterStatus)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      )
    }
    return list
  }, [requests, filterStatus, searchQuery])

  // Most recent request (for header indicator)
  const lastRequest = useMemo(
    () =>
      requests.length > 0
        ? [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null,
    [requests],
  )

  function validate(): boolean {
    const errors: FormErrors = {}
    if (!type) errors.type = 'Selecione o tipo de requerimento.'
    if (description.trim().length < MIN_DESC_LENGTH)
      errors.description = `A descrição deve ter no mínimo ${MIN_DESC_LENGTH} caracteres.`
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function resetForm() {
    setType('')
    setDescription('')
    setFormErrors({})
    setSubmitError('')
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setSuccessMsg(''), 5000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await api.post('/requests', { title: type, description: description.trim() })
      closeForm()
      showSuccess('Requerimento enviado com sucesso! Em breve você receberá uma resposta.')
      setLoading(true)
      await fetchRequests()
    } catch {
      setSubmitError('Não foi possível enviar o requerimento. Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasActiveFilters = filterStatus !== 'ALL' || searchQuery.trim() !== ''

  function clearFilters() {
    setFilterStatus('ALL')
    setSearchQuery('')
  }

  const activeCardLabel = STAT_CARDS.find(c => c.key === filterStatus)?.label ?? 'Todos'

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="section-label mb-2">Área restrita</p>
          <h1 className="text-2xl font-bold text-[#ccd8e0]">
            Meus <span className="neon-text">Requerimentos</span>
          </h1>
          <p className="mt-1 text-sm text-[#4a6172]">
            {loading
              ? 'Carregando...'
              : `${requests.length} requerimento${requests.length !== 1 ? 's' : ''} registrado${requests.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            className="btn-primary text-sm"
            onClick={() => { setShowForm(v => !v); if (showForm) resetForm() }}
          >
            {showForm ? '✕ Cancelar' : '+ Novo requerimento'}
          </button>
          {!loading && lastRequest && !showForm && (
            <div className="flex items-center gap-1.5 rounded border border-[#192633] bg-[#0b1117] px-2.5 py-1">
              <div className="h-1 w-1 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="font-mono text-[9px] text-[#273a47]">
                último {relativeTime(lastRequest.createdAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Success banner ───────────────────────────────────── */}
      {successMsg && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[#39ff8440] bg-[#39ff840e] px-4 py-3 animate-slide-up">
          <span className="mt-0.5 text-[#39ff85] leading-none">✓</span>
          <p className="text-sm text-[#39ff85] flex-1">{successMsg}</p>
          <button
            className="text-[#39ff8566] hover:text-[#39ff85] transition-colors text-xs"
            onClick={() => setSuccessMsg('')}
            aria-label="Fechar"
          >✕</button>
        </div>
      )}

      {/* ── Stat cards / filter ──────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(({ key, label, color, textColor, delta }, i) => {
          const count    = counts[key] ?? 0
          const isActive = filterStatus === key
          const isEmpty  = count === 0 && key !== 'ALL'

          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className="relative w-full overflow-hidden rounded-lg bg-[#0f1820] p-4 text-left transition-all duration-200 border animate-fade-in"
              style={{
                animationDelay: `${i * 60}ms`,
                borderColor: isActive ? `${color}50` : '#192633',
                boxShadow:   isActive ? `0 0 24px ${color}14` : 'none',
              }}
            >
              {/* Accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: `linear-gradient(90deg, ${color} 0%, transparent 65%)` }}
              />

              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a6172]">
                {label}
              </p>

              {loading ? (
                <div className="skeleton mt-3 h-8 w-12" />
              ) : (
                <p className={`mt-3 font-mono text-3xl font-bold transition-colors ${isEmpty ? 'text-[#273a47]' : textColor}`}>
                  {count}
                </p>
              )}

              {/* Distribution bar — only on Total card */}
              {key === 'ALL' && !loading && requests.length > 0 && (
                <div className="mt-2 flex h-1 gap-0.5 overflow-hidden rounded-full">
                  {(counts.PENDING  ?? 0) > 0 && (
                    <div style={{ width: `${((counts.PENDING  ?? 0) / requests.length) * 100}%`, background: '#f0c040' }} />
                  )}
                  {(counts.RESOLVED ?? 0) > 0 && (
                    <div style={{ width: `${((counts.RESOLVED ?? 0) / requests.length) * 100}%`, background: '#00c8ff' }} />
                  )}
                  {(counts.REJECTED ?? 0) > 0 && (
                    <div style={{ width: `${((counts.REJECTED ?? 0) / requests.length) * 100}%`, background: '#ff6070' }} />
                  )}
                </div>
              )}

              <div className="my-2 h-px bg-[#192633]" />
              <p className="text-[9px] text-[#273a47]">{delta}</p>
            </button>
          )
        })}
      </div>

      {/* ── New request form ─────────────────────────────────── */}
      {showForm && (
        <div className="panel-hud p-5 mb-5 animate-slide-up">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#ccd8e0]">Novo requerimento</h2>
            <span className="badge badge-yellow">Rascunho</span>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 max-w-lg">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a6172]">
                Tipo de requerimento
              </label>
              <select
                className={`input-cyber ${formErrors.type ? 'border-red-500/60' : ''}`}
                value={type}
                onChange={e => { setType(e.target.value); setFormErrors(p => ({ ...p, type: undefined })) }}
                disabled={submitting}
              >
                <option value="" disabled>Selecione...</option>
                {TYPES.map(t => (
                  <option key={t} value={t} style={{ backgroundColor: '#080e14' }}>{t}</option>
                ))}
              </select>
              {formErrors.type && <p className="mt-1 text-xs text-red-400">{formErrors.type}</p>}
            </div>

            <div>
              <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a6172]">
                <span>Descrição / justificativa</span>
                <span className={description.trim().length < MIN_DESC_LENGTH ? 'text-[#273a47]' : 'text-[#39ff85]'}>
                  {description.trim().length} caracteres
                </span>
              </label>
              <textarea
                className={`input-cyber resize-none ${formErrors.description ? 'border-red-500/60' : ''}`}
                rows={3}
                placeholder="Descreva brevemente o motivo do requerimento..."
                value={description}
                onChange={e => { setDescription(e.target.value); setFormErrors(p => ({ ...p, description: undefined })) }}
                disabled={submitting}
              />
              {formErrors.description && <p className="mt-1 text-xs text-red-400">{formErrors.description}</p>}
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded border border-red-500/25 bg-red-500/8 px-3 py-2.5">
                <span className="text-red-400 text-sm leading-none mt-0.5">!</span>
                <p className="text-xs text-red-400">{submitError}</p>
              </div>
            )}

            {/* Process timeline hint */}
            <div className="flex items-center justify-between rounded border border-[#192633] bg-[#080e14] px-4 py-2.5">
              <div className="flex items-center gap-2">
                {(['Enviado', 'Em análise', 'Resposta'] as const).map((step, i) => (
                  <Fragment key={step}>
                    <span className="text-[10px] text-[#4a6172]">{step}</span>
                    {i < 2 && <span className="text-[9px] text-[#192633]">→</span>}
                  </Fragment>
                ))}
              </div>
              <span className="font-mono text-[9px] text-[#273a47]">até 5 dias úteis</span>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar requerimento'}
              </button>
              <button type="button" className="btn-ghost text-sm" onClick={closeForm} disabled={submitting}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Requests panel ───────────────────────────────────── */}
      <div className="panel-hud overflow-hidden">

        {/* Panel header */}
        <div className="relative flex items-center justify-between border-b border-[#192633] bg-[#0b1117] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-[#ccd8e0]">
              {filterStatus === 'ALL' ? 'Todos os requerimentos' : activeCardLabel}
            </p>
            {filterStatus !== 'ALL' && (
              <button
                className="text-[9px] text-[#4a6172] hover:text-[#39ff85] transition-colors"
                onClick={() => setFilterStatus('ALL')}
              >
                ← ver todos
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#273a47] text-[11px] pointer-events-none">⌕</span>
              <input
                type="text"
                className="input-cyber pl-6 pr-7 py-1.5 text-[11px] w-44"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a6172] hover:text-[#ccd8e0] transition-colors text-[9px]"
                  aria-label="Limpar busca"
                >✕</button>
              )}
            </div>
            {!loading && (
              <span className="font-mono text-[9px] text-[#273a47] shrink-0">
                {filteredRequests.length}/{requests.length}
              </span>
            )}
          </div>
        </div>

        {/* Table column headers */}
        <div className="grid grid-cols-[88px_1fr_120px_120px] gap-4 border-b border-[#192633] px-5 py-2.5">
          {['Nº', 'Tipo / Descrição', 'Data', 'Status'].map(h => (
            <span key={h} className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#273a47]">{h}</span>
          ))}
        </div>

        {/* Loading */}
        {loading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="text-2xl text-red-400/40">⚠</span>
            <p className="text-sm text-red-400">{error}</p>
            <button
              className="btn-ghost text-xs mt-1 py-1 px-3"
              onClick={() => { setLoading(true); fetchRequests() }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Rows */}
        {!loading && !error && filteredRequests.map((req, i) => {
          const norm = normalizeStatus(req.status)
          return (
            <div
              key={req.id}
              className="data-row grid grid-cols-[88px_1fr_120px_120px] gap-4 px-5 py-4 border-b border-[#192633] animate-fade-in"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span className="font-mono text-xs text-[#39ff85] pt-0.5">{shortId(req.id)}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#ccd8e0] leading-snug truncate">{req.title}</p>
                <p className="mt-0.5 text-[10px] text-[#4a6172] line-clamp-2 leading-relaxed">{req.description}</p>
              </div>
              <div className="flex flex-col gap-0.5 pt-0.5">
                <span className="text-xs text-[#4a6172]">{formatDate(req.createdAt)}</span>
                <span className="font-mono text-[9px] text-[#273a47]">{relativeTime(req.createdAt)}</span>
              </div>
              <div className="pt-0.5">
                <span className={`badge ${STATUS_BADGE[norm] ?? 'badge-yellow'}`}>
                  {STATUS_LABEL[norm] ?? req.status}
                </span>
              </div>
            </div>
          )
        })}

        {/* Empty state — no requests at all */}
        {!loading && !error && requests.length === 0 && (
          <div className="flex flex-col items-center gap-5 px-5 py-16 text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#192633] bg-[#0f1820]">
              <svg className="w-7 h-7 text-[#273a47]" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.2}>
                <rect x="8" y="6" width="32" height="36" rx="3" />
                <line x1="15" y1="16" x2="33" y2="16" />
                <line x1="15" y1="22" x2="33" y2="22" />
                <line x1="15" y1="28" x2="24" y2="28" />
              </svg>
            </div>
            <div className="max-w-xs">
              <p className="text-sm font-semibold text-[#4a6172]">Nenhum requerimento ainda</p>
              <p className="mt-1.5 text-xs text-[#273a47] leading-relaxed">
                Você pode solicitar declarações, históricos, revisões de nota e muito mais.
                Clique em <span className="text-[#39ff85]/60">+ Novo requerimento</span> para abrir sua primeira solicitação.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
              {TYPES.slice(0, 4).map(t => <span key={t} className="tag">{t}</span>)}
              <span className="tag">+ {TYPES.length - 4} tipos</span>
            </div>
          </div>
        )}

        {/* Empty state — active filters returned nothing */}
        {!loading && !error && requests.length > 0 && filteredRequests.length === 0 && (
          <div className="flex flex-col items-center gap-4 px-5 py-14 text-center animate-fade-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#192633] bg-[#0f1820]">
              <span className="text-xl text-[#273a47]">⌕</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#4a6172]">Nenhum resultado encontrado</p>
              <p className="mt-1 text-xs text-[#273a47]">Nenhum requerimento corresponde aos filtros aplicados.</p>
            </div>
            {hasActiveFilters && (
              <button className="btn-ghost text-xs py-1.5 px-4" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Bottom status strip */}
        {!loading && !error && requests.length > 0 && (
          <div className="border-t border-[#192633] bg-[#0b1117] px-5 py-2">
            <div className="flex items-center gap-3">
              <div className="h-1 w-1 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-[9px] uppercase tracking-widest text-[#273a47]">
                {filteredRequests.length} de {requests.length} requerimentos
                {filterStatus !== 'ALL' && ` · filtro: ${activeCardLabel}`}
                {searchQuery.trim() && ` · busca: "${searchQuery}"`}
              </span>
              {hasActiveFilters && (
                <button
                  className="ml-auto text-[9px] text-[#4a6172] hover:text-[#39ff85] transition-colors"
                  onClick={clearFilters}
                >
                  limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
