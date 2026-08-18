import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './services/api'
import { createDashboardSocket } from './services/socket'
import './image-generation.css'
import './hot-ai.css'

const navItems = [
  { key: 'all', label: '总览', mark: '◈' },
  { key: 'hackernews', label: 'HackerNews', mark: 'H' },
  { key: 'bing', label: 'Bing', mark: 'B' },
  { key: 'bilibili', label: 'B站', mark: '播' },
  { key: 'ai', label: 'AI 推荐', mark: '✦' },
  { key: 'high', label: '高热度', mark: '↗' },
  { key: 'image', label: 'AI 生图', mark: '▧' },
]

function App() {
  const [page, setPage] = useState('login')
  const [user, setUser] = useState(null)
  const authCheckRef = useRef({ requestId: 0, resolved: false })

  useEffect(() => {
    const handleExpired = () => {
      authCheckRef.current.resolved = true
      setUser(null)
      setPage('login')
    }
    window.addEventListener('auth:expired', handleExpired)
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [])

  useEffect(() => {
    // StrictMode runs effects twice in development. Ignore stale auth probes
    // so an initial /auth/me failure cannot overwrite a successful login.
    const requestId = ++authCheckRef.current.requestId
    api.me().then((result) => {
      if (requestId !== authCheckRef.current.requestId || authCheckRef.current.resolved) return
      authCheckRef.current.resolved = true
      if (result.data) {
        setUser(result.data)
        setPage('dashboard')
      }
    }).catch(() => {
      if (requestId === authCheckRef.current.requestId && !authCheckRef.current.resolved) {
        authCheckRef.current.resolved = true
        setPage('login')
      }
    })
  }, [])

  const handleAuth = (nextUser) => {
    authCheckRef.current.resolved = true
    setUser(nextUser)
    setPage('dashboard')
  }

  if (page === 'login') return <AuthPage mode="login" onSuccess={handleAuth} onSwitch={() => setPage('register')} />
  if (page === 'register') return <AuthPage mode="register" onSuccess={handleAuth} onSwitch={() => setPage('login')} />
  return <Dashboard user={user} onLogout={() => { api.logout(); setUser(null); setPage('login') }} />
}

function AuthPage({ mode, onSuccess, onSwitch }) {
  const isLogin = mode === 'login'
  const [form, setForm] = useState({ account: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (submitLockRef.current) return
    setError('')
    const account = form.account.trim()
    if (!account || !form.password) return setError('请输入账号和密码')
    if (!isLogin && form.password !== form.confirmPassword) return setError('两次输入的密码不一致')
    submitLockRef.current = true
    setLoading(true)
    try {
      const result = isLogin
        ? await api.login({ ...form, account, email: account })
        : await api.register({ ...form, account, email: account })
      onSuccess(result.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      submitLockRef.current = false
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-lockup">
          <div className="brand-icon">H</div>
          <div>
            <strong>Hot Monitor</strong>
            <span>AI 热点监控台</span>
          </div>
        </div>
        <div className="auth-heading">
          <p className="eyebrow">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</p>
          <h1>{isLogin ? '登录你的监控台' : '创建监控账号'}</h1>
          <p>{isLogin ? '掌握实时信息流，及时发现值得关注的变化。' : '注册后即可进入实时热点仪表盘。'}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>账号<input type="text" autoComplete="username" placeholder="请输入账号、手机号或邮箱" value={form.account} onChange={(event) => setForm({ ...form, account: event.target.value })} /></label>
          <label>密码<input type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="请输入密码" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {!isLogin && <label>确认密码<input type="password" autoComplete="new-password" placeholder="再次输入密码" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>}
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary-button full-width" disabled={loading}>{loading ? '处理中...' : isLogin ? '进入仪表盘' : '创建账号'}</button>
        </form>
        <p className="auth-switch">{isLogin ? '还没有账号？' : '已有账号？'}<button type="button" className="text-button" onClick={onSwitch}>{isLogin ? '立即注册' : '返回登录'}</button></p>
      </section>
      <aside className="auth-aside">
        <div className="signal-orbit"><span>LIVE</span></div>
        <p className="eyebrow">SIGNAL OVERVIEW</p>
        <h2>让重要信息<br />更早抵达。</h2>
        <p>聚合多个公开来源，借助 AI 完成摘要、评分与分级，在一个清晰的工作台里掌握变化。</p>
        <div className="aside-metrics"><span><b>3</b>数据源</span><span><b>5m</b>采集间隔</span><span><b>24/7</b>实时监控</span></div>
      </aside>
    </main>
  )
}

function Dashboard({ user, onLogout }) {
  const [items, setItems] = useState([])
  const [overview, setOverview] = useState({})
  const [source, setSource] = useState('all')
  const [sort, setSort] = useState('latest')
  const [keyword, setKeyword] = useState('')
  const [activeNav, setActiveNav] = useState('all')
  const [socketStatus, setSocketStatus] = useState('connecting')
  const [newCount, setNewCount] = useState(0)
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [aiSettings, setAiSettings] = useState(null)
  const [aiSettingsLoading, setAiSettingsLoading] = useState(true)
  const [aiSettingsError, setAiSettingsError] = useState('')
  const [aiToggleLoading, setAiToggleLoading] = useState(false)

  async function loadData() {
    const [itemResult, overviewResult] = await Promise.all([api.hotItems({ source, sort, keyword }), api.overview()])
    setItems(itemResult.data.items)
    setOverview(overviewResult.data)
  }

  useEffect(() => {
    if (activeNav === 'image') return undefined
    loadData().catch((error) => setToast(error.message))
    return undefined
  }, [source, sort, keyword, activeNav])

  useEffect(() => {
    if (activeNav === 'image') return undefined
    let mounted = true
    setAiSettingsLoading(true)
    setAiSettingsError('')
    api.hotItemAISettings().then((result) => {
      if (mounted) setAiSettings(result.data)
    }).catch((error) => {
      if (mounted) setAiSettingsError(error.message || 'AI 开关状态加载失败')
    }).finally(() => {
      if (mounted) setAiSettingsLoading(false)
    })
    return () => { mounted = false }
  }, [activeNav])

  async function toggleHotItemAI() {
    if (!aiSettings || aiToggleLoading) return
    setAiToggleLoading(true)
    setAiSettingsError('')
    try {
      const result = await api.updateHotItemAISettings(!aiSettings.requestedEnabled)
      setAiSettings(result.data)
    } catch (error) {
      setAiSettingsError(error.message || 'AI 开关更新失败')
    } finally {
      setAiToggleLoading(false)
    }
  }

  useEffect(() => {
    if (activeNav === 'image') return undefined
    const socket = createDashboardSocket({
      userId: user?.id,
      filters: { source },
      onStatus: setSocketStatus,
      onNewItem: (item) => { setItems((current) => [item, ...current]); setNewCount((count) => count + 1); setToast('收到新的热点推送') },
      onUpdate: (item) => setItems((current) => current.map((entry) => entry.id === item.id ? item : entry)),
      onStats: setOverview,
      onError: setToast,
    })
    return () => socket.disconnect()
  }, [user?.id, source, activeNav])

  const visibleItems = useMemo(() => {
    if (activeNav === 'high') return items.filter((item) => item.rawScore > 600)
    if (activeNav === 'ai') return items.filter((item) => item.aiScore >= 85)
    return items
  }, [activeNav, items])

  function selectNav(key) {
    setActiveNav(key)
    if (key === 'image') setToast('')
    if (['hackernews', 'bing', 'bilibili'].includes(key)) setSource(key)
    if (key === 'all') setSource('all')
  }

  const imageWorkspace = activeNav === 'image'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-icon small">H</div><div><strong>Hot Monitor</strong><span>AI SIGNAL DESK</span></div></div>
        <div className="nav-section-label">工作台</div>
        <nav>{navItems.filter((item) => item.key !== 'image').map((item) => <button type="button" key={item.key} className={`nav-item ${activeNav === item.key ? 'active' : ''}`} onClick={() => selectNav(item.key)}><span className="nav-mark">{item.mark}</span>{item.label}{item.key === 'all' && <i>实时</i>}</button>)}</nav>
        <div className="nav-section-label nav-section-tools">创作工具</div>
        <nav>{navItems.filter((item) => item.key === 'image').map((item) => <button type="button" key={item.key} className={`nav-item ${activeNav === item.key ? 'active' : ''}`} onClick={() => selectNav(item.key)}><span className="nav-mark">{item.mark}</span>{item.label}</button>)}</nav>
        <div className="sidebar-footer"><div className={`status-dot ${socketStatus}`} /><div><strong>{socketStatus === 'connected' ? '实时连接正常' : '正在连接'}</strong><span>每 5 分钟自动采集</span></div></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">{imageWorkspace ? 'CREATIVE TOOLS / AI IMAGE' : 'OVERVIEW / REAL-TIME FEED'}</p><h1>{imageWorkspace ? 'AI 生图' : '热点总览'}</h1></div><div className="topbar-actions">{!imageWorkspace && <button type="button" className="icon-button" title="刷新数据" onClick={() => loadData()}>↻</button>}<div className="profile"><div className="avatar">{user?.email?.slice(0, 1).toUpperCase() || 'D'}</div><div><strong>{user?.email || 'demo@hotmonitor.dev'}</strong><span>观察员</span></div><button type="button" className="logout-button" onClick={onLogout}>退出</button></div></div></header>
        {!imageWorkspace && newCount > 0 && <button type="button" className="new-items-banner" onClick={() => { setNewCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>↓ 有 {newCount} 条新热点，点击查看</button>}
        {imageWorkspace ? <ImageGenerationWorkspaceV2 /> : <>
        <section className="overview-grid">
          <MetricCard label="今日新增热点" value={overview.todayCount ?? '--'} note="较昨日 +12.8%" tone="blue" />
          <MetricCard label="活跃数据源" value={overview.sourceCount ?? '--'} note="HackerNews / Bing / B站" tone="green" />
          <MetricCard label="AI 已分析" value={overview.analyzedCount ?? '--'} note="结构化摘要完成" tone="purple" />
          <MetricCard label="高重要性事件" value={overview.highImportanceCount ?? '--'} note="建议优先关注" tone="orange" />
        </section>
        <section className="content-section">
          <div className="section-heading"><div><h2>实时热点流</h2><p>来自多个公开来源的 AI 筛选信息</p></div><div className="hot-ai-controls"><div className="hot-ai-status"><strong>热点 AI 分析</strong><span className={`hot-ai-state ${hotItemAIStateClass(aiSettings)}`}>{aiSettingsLoading ? '读取中…' : aiSettingsError ? '状态未知' : hotItemAIStateLabel(aiSettings)}</span></div><label className="switch-control" title="开启后新采集的热点会调用 AI 分析"><input type="checkbox" checked={Boolean(aiSettings?.requestedEnabled)} onChange={toggleHotItemAI} disabled={aiSettingsLoading || aiToggleLoading || Boolean(aiSettingsError) || (!aiSettings?.requestedEnabled && (aiSettings?.deploymentAllowed === false || aiSettings?.configured === false))} /><span className="switch-track" aria-hidden="true" /></label><span className="last-updated"><span className="pulse" />最后采集 {overview.latestCollectTime || '—'}</span></div></div>
          {aiSettingsError && <div className="hot-ai-error">{aiSettingsError} <button type="button" className="text-button" onClick={() => { setAiSettingsError(''); setAiSettingsLoading(true); api.hotItemAISettings().then((result) => setAiSettings(result.data)).catch((error) => setAiSettingsError(error.message || 'AI 开关状态加载失败')).finally(() => setAiSettingsLoading(false)) }}>重试</button></div>}
          <div className="filters-bar"><div className="search-field"><span>⌕</span><input placeholder="搜索标题或摘要..." value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div><select value={source} onChange={(event) => { setSource(event.target.value); setActiveNav(event.target.value) }}><option value="all">全部来源</option><option value="hackernews">HackerNews</option><option value="bing">Bing</option><option value="bilibili">B站</option></select><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">最新采集</option><option value="score">热度最高</option><option value="ai">AI 推荐</option></select><button type="button" className="filter-button" onClick={() => { setKeyword(''); setSource('all'); setSort('latest'); setActiveNav('all') }}>清除筛选</button></div>
          <div className="table-wrap"><table><thead><tr><th>热点内容</th><th>来源</th><th>AI 摘要</th><th>热度</th><th>相关性</th><th>采集时间</th><th /></tr></thead><tbody>{visibleItems.map((item) => <HotItemRow key={item.id} item={item} onClick={() => setSelected(item)} />)}</tbody></table>{visibleItems.length === 0 && <div className="empty-state"><strong>没有匹配的热点</strong><span>试试清除筛选条件或换一个关键词。</span></div>}</div>
        </section>
        </>}
      </main>
      {selected && <DetailDrawer item={selected} onClose={() => setSelected(null)} />}
      {toast && <button className="toast" onClick={() => setToast('')}>{toast}<span>×</span></button>}
    </div>
  )
}

function ImageGenerationWorkspace() {
  const [form, setForm] = useState({ prompt: '', negativePrompt: '', size: '1024x1024', n: 1 })
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const prompt = form.prompt.trim()
    if (!prompt) {
      setError('请输入图片描述')
      return
    }
    if (prompt.length > 1000) {
      setError('提示词不能超过 1000 个字符')
      return
    }
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await api.imageGenerate({
        prompt,
        negativePrompt: form.negativePrompt.trim() || undefined,
        size: form.size,
        // Keep the legacy `n` field while also sending the image-studio contract.
        count: Number(form.n),
        quality: 'auto',
        referenceImage: '',
        n: Number(form.n),
      })
      const nextImages = result.data?.images || []
      setImages(nextImages)
      setNotice(nextImages.length ? `已生成 ${nextImages.length} 张图片` : '服务未返回图片，请稍后重试')
      if (!nextImages.length) setError('服务未返回图片，请稍后重试')
    } catch (requestError) {
      setImages([])
      setError(requestError.message || '生图失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="image-workspace">
      <div className="image-intro">
        <p className="eyebrow">PROMPT TO IMAGE</p>
        <h2>把想法变成画面</h2>
        <p>输入清晰的画面描述，选择尺寸和生成数量，结果会显示在右侧工作区。</p>
      </div>
      <div className="image-workspace-grid">
        <form className="image-form" onSubmit={submit}>
          <label>提示词 <span className="field-hint">{form.prompt.length}/1000</span>
            <textarea rows="7" maxLength="1000" value={form.prompt} onChange={(event) => updateField('prompt', event.target.value)} placeholder="例如：一座被云海环绕的未来城市，清晨柔和的金色光线，电影感构图" />
          </label>
          <label>反向提示词 <span className="optional-label">可选</span>
            <input value={form.negativePrompt} onChange={(event) => updateField('negativePrompt', event.target.value)} placeholder="例如：模糊、低质量、文字水印" />
          </label>
          <div className="image-form-row">
            <label>图片尺寸
              <select value={form.size} onChange={(event) => updateField('size', event.target.value)}><option value="1024x1024">1024 × 1024</option><option value="1536x1024">1536 × 1024</option><option value="1024x1536">1024 × 1536</option></select>
            </label>
            <label>生成数量
              <select value={form.n} onChange={(event) => updateField('n', event.target.value)}><option value="1">1 张</option><option value="2">2 张</option><option value="3">3 张</option><option value="4">4 张</option></select>
            </label>
          </div>
          {error && <div className="form-error image-error">{error}</div>}
          <button type="submit" className="primary-button image-submit" disabled={loading}>{loading ? '正在生成…' : '生成图片'}</button>
          <p className="image-form-note">生图服务使用独立的服务端 API 配置，前端不会接触供应商密钥。</p>
        </form>
        <div className="image-results" aria-live="polite">
          <div className="image-results-header"><div><span className="block-label">生成结果</span><strong>{loading ? '正在渲染...' : notice || '等待一次生成'}</strong></div>{images.length > 0 && <button type="button" className="text-button" onClick={() => setImages([])}>清空</button>}</div>
          {loading && <div className="image-loading"><span className="loading-spinner" /><p>模型正在绘制你的画面</p><small>这通常需要几秒钟，请稍候</small></div>}
          {!loading && images.length === 0 && <div className="image-empty"><span className="empty-image-mark">✦</span><strong>你的图片会出现在这里</strong><p>完成左侧设置后点击“生成图片”</p></div>}
          {!loading && images.length > 0 && <div className="image-grid">{images.map((image, index) => <figure className="generated-image-card" key={`${image.url}-${index}`}><img src={image.url} alt={image.revisedPrompt || form.prompt} /><figcaption><span>图片 {index + 1}</span><a href={image.url} download={`ai-image-${index + 1}.png`} target="_blank" rel="noreferrer">下载 ↓</a></figcaption></figure>)}</div>}
        </div>
      </div>
    </section>
  )
}

function MetricCard({ label, value, note, tone }) { return <article className="metric-card"><div className={`metric-icon ${tone}`}>◈</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><b className="metric-trend">↗</b></article> }
function hotItemAIStateLabel(settings) {
  settings = settings || {}
  if (settings.deploymentAllowed === false) return '部署未允许'
  if (settings.configured === false) return '配置缺失'
  if (!settings?.requestedEnabled) return '已关闭'
  return settings.effectiveEnabled === false ? '配置缺失' : '已开启'
}

function hotItemAIStateClass(settings) {
  settings = settings || {}
  if (settings.deploymentAllowed === false) return 'blocked'
  if (settings.configured === false) return 'missing'
  if (!settings?.requestedEnabled) return 'off'
  if (settings.effectiveEnabled === false) return 'missing'
  return 'on'
}

function isHotItemAnalyzed(item) { return ['completed', 'succeeded', 'analyzed'].includes(String(item?.analysisStatus || '').toLowerCase()) }
function hotItemSummary(item) { if (!isHotItemAnalyzed(item)) return String(item?.analysisStatus || '').toLowerCase() === 'disabled' ? 'AI 分析未开启' : '等待 AI 分析'; return item.summary || '暂无摘要' }
function hotItemImportance(item) { if (!isHotItemAnalyzed(item)) return '—'; return item.importanceLevel === 'high' ? '高' : item.importanceLevel === 'medium' ? '中' : '低' }
function HotItemRow({ item, onClick }) { const tags = Array.isArray(item.tags) ? item.tags : []; const aiScore = item.aiScore ?? '—'; return <tr onClick={onClick}><td><div className="item-title"><strong>{item.title}</strong><div className="tag-list">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div></td><td><span className={`source-badge ${item.source}`}>{item.sourceName}</span></td><td><span className="summary">{hotItemSummary(item)}</span></td><td><strong className="score">{item.rawScore}</strong></td><td><span className={`ai-score ${item.aiScore >= 85 ? 'good' : ''} ${item.aiScore === null ? 'pending' : ''}`}>{aiScore}</span></td><td><span className="collected-time">{item.collectedAt}</span></td><td><span className="row-arrow">→</span></td></tr> }
function DetailDrawer({ item, onClose }) { const tags = Array.isArray(item.tags) ? item.tags : []; return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-header"><span className={`source-badge ${item.source}`}>{item.sourceName}</span><button type="button" className="icon-button" onClick={onClose}>×</button></div><p className="eyebrow">HOT ITEM DETAIL</p><h2>{item.title}</h2><div className="drawer-scores"><div><span>热度分</span><strong>{item.rawScore}</strong></div><div><span>相关性</span><strong>{item.aiScore ?? '—'}</strong></div><div><span>重要性</span><strong>{hotItemImportance(item)}</strong></div></div><div className="drawer-block"><span className="block-label">AI 摘要</span><p>{hotItemSummary(item)}</p></div><div className="drawer-block"><span className="block-label">标签</span><div className="tag-list">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><a className="primary-button source-link" href={item.url} target="_blank" rel="noreferrer">打开原文 ↗</a></aside></div> }

function ImageGenerationWorkspaceV2() {
  const [form, setForm] = useState({ prompt: '', negativePrompt: '', style: '', size: '1024x1024', n: 1 })
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [history, setHistory] = useState({ items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewIndex, setPreviewIndex] = useState(null)
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  async function loadHistory(page = 1) {
    setHistoryLoading(true); setHistoryError('')
    try { const result = await api.imageHistory({ page, pageSize: 12 }); setHistory(result.data || { items: [], page, pageSize: 12, total: 0, totalPages: 0 }) }
    catch (requestError) { setHistoryError(requestError.message || '历史记录加载失败') }
    finally { setHistoryLoading(false) }
  }
  useEffect(() => { loadHistory().catch(() => {}) }, [])
  async function polishPrompt() {
    const prompt = form.prompt.trim(); if (!prompt) { setError('请先输入提示词'); return }
    setPolishing(true); setError(''); setNotice('')
    try { const result = await api.imagePolish({ prompt, negativePrompt: form.negativePrompt.trim() || undefined, style: form.style.trim() || undefined, language: 'zh-CN' }); const polished = result.data || {}; setForm((current) => ({ ...current, prompt: polished.prompt || current.prompt, negativePrompt: polished.negativePrompt || current.negativePrompt })); setNotice('AI 润色完成，可继续编辑后生成') }
    catch (requestError) { setError(requestError.message || 'AI 润色失败，请稍后重试') } finally { setPolishing(false) }
  }
  async function submit(event) {
    event.preventDefault(); const prompt = form.prompt.trim(); if (!prompt) { setError('请输入图片描述'); return }; if (prompt.length > 1000) { setError('提示词不能超过 1000 个字符'); return }
    setLoading(true); setError(''); setNotice(''); setPreviewIndex(null)
    try { const result = await api.imageGenerate({ prompt, negativePrompt: form.negativePrompt.trim() || undefined, size: form.size, count: Number(form.n), quality: 'auto', referenceImage: '', n: Number(form.n) }); const nextImages = result.data?.images || []; setImages(nextImages); setNotice(nextImages.length ? `已生成 ${nextImages.length} 张图片` : '服务未返回图片，请稍后重试'); if (!nextImages.length) setError('服务未返回图片，请稍后重试'); loadHistory().catch(() => {}) }
    catch (requestError) { setImages([]); setError(requestError.message || '生图失败，请稍后重试') } finally { setLoading(false) }
  }
  function selectHistory(item) { setForm((current) => ({ ...current, prompt: item.prompt || '', negativePrompt: item.negativePrompt || '', size: item.size || current.size, n: item.count || current.n })); setImages(item.images || []); setNotice('已载入历史记录'); setPreviewIndex(null) }
  const previewImage = previewIndex === null ? null : images[previewIndex]
  return <section className="image-workspace">
    <div className="image-intro"><p className="eyebrow">PROMPT TO IMAGE</p><h2>把想法变成画面</h2><p>输入描述，先用 AI 润色提示词，再生成并管理你的图片历史。</p></div>
    <div className="image-workspace-grid"><form className="image-form" onSubmit={submit}>
      <label>提示词<span className="field-hint">{form.prompt.length}/1000</span><textarea rows="7" maxLength="1000" value={form.prompt} onChange={(event) => updateField('prompt', event.target.value)} placeholder="例如：一座被云海环绕的未来城市，清晨柔和的金色光线，电影感构图" /></label>
      <label>反向提示词<span className="optional-label">可选</span><input value={form.negativePrompt} onChange={(event) => updateField('negativePrompt', event.target.value)} placeholder="例如：模糊、低质量、文字水印" /></label>
      <label>风格<span className="optional-label">可选</span><input value={form.style} onChange={(event) => updateField('style', event.target.value)} placeholder="例如：电影感、写实" /></label>
      <div className="image-form-row"><label>图片尺寸<select value={form.size} onChange={(event) => updateField('size', event.target.value)}><option value="1024x1024">1024 × 1024</option><option value="1536x1024">1536 × 1024</option><option value="1024x1536">1024 × 1536</option></select></label><label>生成数量<select value={form.n} onChange={(event) => updateField('n', event.target.value)}><option value="1">1 张</option><option value="2">2 张</option><option value="3">3 张</option><option value="4">4 张</option></select></label></div>
      {error && <div className="form-error image-error">{error}</div>}<div className="image-form-actions"><button type="button" className="secondary-button" onClick={polishPrompt} disabled={loading || polishing}>{polishing ? '润色中…' : 'AI 润色提示词'}</button><button type="submit" className="primary-button image-submit" disabled={loading || polishing}>{loading ? '正在生成…' : '生成图片'}</button></div>{notice && <p className="image-form-note image-notice">{notice}</p>}<p className="image-form-note">润色复用文本 API 配置，生图使用独立 API 配置。</p>
    </form><div className="image-results" aria-live="polite"><div className="image-results-header"><div><span className="block-label">生成结果</span><strong>{loading ? '正在渲染...' : notice || '等待一次生成'}</strong></div>{images.length > 0 && <button type="button" className="text-button" onClick={() => setImages([])}>清空</button>}</div>
      {loading && <div className="image-loading"><span className="loading-spinner" /><p>模型正在绘制你的画面</p><small>这通常需要几秒钟，请稍候</small></div>}{!loading && images.length === 0 && <div className="image-empty"><span className="empty-image-mark">✦</span><strong>你的图片会出现在这里</strong><p>完成左侧设置后点击“生成图片”</p></div>}{!loading && images.length > 0 && <div className="image-grid">{images.map((image, index) => <figure className="generated-image-card" key={`${image.url}-${index}`}><button type="button" className="image-preview-trigger" onClick={() => setPreviewIndex(index)}><img src={image.url} alt={image.revisedPrompt || form.prompt} /></button><figcaption><span>图片 {index + 1}</span><a href={image.url} download={`ai-image-${index + 1}.png`} target="_blank" rel="noreferrer">下载 ↗</a></figcaption></figure>)}</div>}
    </div></div>
    <section className="image-history"><div className="image-history-header"><div><span className="block-label">历史记录</span><strong>{history.total ? `共 ${history.total} 条` : '暂无历史记录'}</strong></div><button type="button" className="text-button" onClick={() => loadHistory(history.page)} disabled={historyLoading}>刷新</button></div>{historyLoading && <div className="history-state">正在加载历史记录…</div>}{!historyLoading && historyError && <div className="history-state history-error">{historyError} <button type="button" className="text-button" onClick={() => loadHistory(history.page)}>重试</button></div>}{!historyLoading && !historyError && history.items.length === 0 && <div className="history-state">生成图片后，记录会显示在这里</div>}{!historyLoading && !historyError && history.items.length > 0 && <><div className="history-grid">{history.items.map((item) => <button type="button" className="history-card" key={item.id} onClick={() => selectHistory(item)}><span className="history-thumb">{item.images?.[0]?.url ? <img src={item.images[0].url} alt="" /> : <span>无预览</span>}</span><span className="history-card-body"><strong>{item.prompt}</strong><small>{item.status === 'succeeded' ? '已完成' : item.status || '处理中'} · {new Date(item.createdAt).toLocaleString('zh-CN')}</small></span></button>)}</div><div className="history-pagination"><button type="button" className="text-button" disabled={history.page <= 1 || historyLoading} onClick={() => loadHistory(history.page - 1)}>上一页</button><span>{history.page} / {Math.max(1, history.totalPages || 1)}</span><button type="button" className="text-button" disabled={history.page >= history.totalPages || historyLoading} onClick={() => loadHistory(history.page + 1)}>下一页</button></div></>}
    </section>{previewImage && <div className="image-preview-backdrop" role="dialog" aria-modal="true" onClick={() => setPreviewIndex(null)}><div className="image-preview-dialog" onClick={(event) => event.stopPropagation()}><button type="button" className="image-preview-close" onClick={() => setPreviewIndex(null)} aria-label="关闭预览">×</button><img src={previewImage.url} alt={previewImage.revisedPrompt || form.prompt} /><div className="image-preview-actions"><button type="button" className="text-button" disabled={previewIndex <= 0} onClick={() => setPreviewIndex((index) => index - 1)}>上一张</button><span>{previewIndex + 1} / {images.length}</span><button type="button" className="text-button" disabled={previewIndex >= images.length - 1} onClick={() => setPreviewIndex((index) => index + 1)}>下一张</button><a href={previewImage.url} download="ai-image-preview.png">下载图片</a></div></div></div>}
  </section>
}

export default App
