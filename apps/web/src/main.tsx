import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
type User = { id: string; name: string; login: string; role: "ADMIN" | "VENDEDOR" };
type Product = { id: string; internalCode: string; name: string; unit: string; photoUrl?: string | null; category: { id: string; name: string }; identifiers?: { type?: "QR" | "BARCODE"; normalizedValue: string }[] };
type Category = { id: string; name: string };
type Balance = { id: string; name: string; kind: "CATEGORIA" | "PERSONALIZADO"; categoryId?: string | null; selectedCategories?: Category[]; status: string; itemCount: number; myCountedItemCount: number; createdAt?: string; openedAt?: string | null; closedAt?: string | null; cancelledAt?: string | null; cancellationReason?: string | null; createdBy?: { id: string; name: string; login: string }; assignedSellers?: { id: string; name: string; login: string; active: boolean }[] };
type BalanceCount = { id: string; quantity: string; countedAt: string; countedBy: { id: string; name: string }; observation: string | null; isRecount: boolean };
type BalanceDetailItem = { id: string; size?: number | null; referenceQuantity: string; status: string; product: Product; counts: BalanceCount[] };
type BalanceReportItem = { id: string; product: Product; size?: number | null; referenceQuantity: string; finalQuantity: string | null; status: string; approvedAt: string | null; approvedBy: { id: string; name: string; login: string } | null; counts: (BalanceCount & { countedBy: { id: string; name: string; login: string }; approved: boolean })[] };
type BalanceReport = { generatedAt: string; balance: { id: string; name: string; kind: "CATEGORIA" | "PERSONALIZADO"; categoryId: string | null; selectedCategories: Category[]; status: string; createdAt: string; openedAt: string | null; closedAt: string | null; cancelledAt: string | null; cancellationReason: string | null; createdBy: { id: string; name: string; login: string }; assignedSellers: { id: string; name: string; login: string }[]; itemCount: number }; categories: { id: string; name: string; items: BalanceReportItem[] }[] };
type BalanceDetailView = { balance: Balance; report?: BalanceReport; items?: BalanceDetailItem[] };
type ManagedUser = { id: string; name: string; login: string; role: "ADMIN" | "VENDEDOR"; active: boolean; createdAt: string; updatedAt: string };

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(body?.error?.message ?? `Erro HTTP ${response.status}`, response.status, body?.error?.code);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

function Login({ onLogin, message = "" }: { onLogin: (token: string, user: User) => void; message?: string }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST", body: JSON.stringify({ login, password })
      });
      onLogin(result.token, result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao entrar.");
    }
  }
  return <main className="login-page"><form className="login-card" onSubmit={submit}>
    <span className="eyebrow">ESTOQUE</span><h1>Painel administrativo</h1>
    <p className="muted">Entre com sua conta individual para administrar o inventário.</p>
    <label>Usuário<input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" required /></label>
    <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
    {message && <div className="success" role="status">{message}</div>}{error && <div className="error">{error}</div>}<button className="primary" type="submit">Entrar</button>
  </form></main>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("estoque.token") ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [starting, setStarting] = useState(() => Boolean(localStorage.getItem("estoque.token")));
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [section, setSection] = useState<"dashboard" | "products" | "balances" | "users">(() => window.location.pathname.startsWith("/balances/") ? "balances" : "dashboard");
  useEffect(() => {
    if (!token) { setStarting(false); return; }
    let active = true;
    api<{ user: User }>("/auth/me", {}, token).then((result) => { if (active) setUser(result.user); }).catch(() => {
      if (!active) return;
      localStorage.removeItem("estoque.token"); setToken("");
    }).finally(() => { if (active) setStarting(false); });
    return () => { active = false; };
  }, [token]);
  if (starting) return <BrandLoadingScreen />;
  if (!token || !user) return <Login message={loginMessage} onLogin={(newToken, loggedUser) => {
    localStorage.setItem("estoque.token", newToken); setToken(newToken); setUser(loggedUser); setStarting(true); window.setTimeout(() => setStarting(false), 450);
  }} />;
  const logout = () => { localStorage.removeItem("estoque.token"); setToken(""); setUser(null); };
  return <div className="shell">
    <aside><div className="brand"><span className="brand-mark">E</span><span>Estoque</span></div>
      <nav>{([
        ["dashboard", "Visão geral"], ["products", "Produtos"], ["balances", "Balanços"], ["users", "Usuários"]
      ] as const).filter(([key]) => key !== "users" || user.role === "ADMIN").map(([key, label]) => <button className={section === key ? "nav-active" : ""} key={key} onClick={() => setSection(key)}>{label}</button>)}</nav>
      <div className="sidebar-user"><strong>{user.name}</strong><span>{user.role}</span><button onClick={() => setPasswordDialog(true)}>Trocar senha</button><button onClick={logout}>Sair</button></div>
    </aside>
    <main className="content"><header><div><span className="eyebrow">PAINEL</span><h1>{section === "dashboard" ? "Visão geral" : section === "products" ? "Produtos" : section === "users" ? "Usuários" : "Balanços"}</h1></div><span className="connection"><i /> API conectada</span></header>
      {section === "dashboard" && <Dashboard token={token} onNavigate={setSection} />}
      {section === "products" && <Products token={token} />}
      {section === "balances" && <Balances token={token} user={user} />}
      {section === "users" && (user.role === "ADMIN" ? <Users token={token} /> : <div className="error" role="alert">Acesso negado. Área exclusiva para ADMIN.</div>)}
    </main>
    {passwordDialog && <OwnPasswordDialog token={token} onClose={() => setPasswordDialog(false)} onSuccess={() => { setPasswordDialog(false); setLoginMessage("Senha alterada. Entre novamente com a nova senha."); logout(); }} />}
  </div>;
}

function BrandLoadingScreen() {
  return <main className="app-loading" role="status" aria-live="polite"><img src="/brand/atacadista-silva.svg" alt="Atacadista Silva" /><span className="loading-spinner" aria-hidden="true" /><p>Preparando seu inventário…</p></main>;
}

function Users({ token }: { token: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState(""); const [role, setRole] = useState(""); const [active, setActive] = useState("");
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false); const [name, setName] = useState(""); const [login, setLogin] = useState(""); const [password, setPassword] = useState(""); const [newRole, setNewRole] = useState<"ADMIN" | "VENDEDOR">("VENDEDOR");
  const [editing, setEditing] = useState<ManagedUser | null>(null); const [editName, setEditName] = useState(""); const [editLogin, setEditLogin] = useState(""); const [editRole, setEditRole] = useState<"ADMIN" | "VENDEDOR">("VENDEDOR");
  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null); const [statusReason, setStatusReason] = useState("");
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null); const [resetPasswordValue, setResetPasswordValue] = useState(""); const [resetConfirm, setResetConfirm] = useState("");
  const [pending, setPending] = useState(false); const submitLock = useRef(false); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const pageSize = 20;
  const explain = (reason: unknown) => reason instanceof ApiError && reason.status === 401 ? "Sua sessão expirou. Entre novamente." : reason instanceof ApiError && reason.status === 403 ? "Acesso negado. Somente ADMIN pode gerenciar usuários." : reason instanceof ApiError && reason.status === 409 ? "Conflito: confira se o login já existe e se há outra conta ADMIN ativa." : reason instanceof Error ? reason.message : "Não foi possível concluir a operação.";
  async function load(signal?: AbortSignal) {
    setLoading(true);
    try { const params = new URLSearchParams({ limit: String(pageSize), page: String(page) }); if (query.trim()) params.set("q", query.trim()); if (role) params.set("role", role); if (active) params.set("active", active); const result = await api<{ data: ManagedUser[]; total: number }>(`/users?${params}`, (signal ? { signal } : {}), token); setUsers(result.data); setTotal(result.total); setError(""); }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(explain(reason)); } finally { setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [token, query, role, active, page]);
  function fail(reason: unknown) { setError(explain(reason)); setMessage(""); }
  async function create(event: FormEvent) { event.preventDefault(); if (pending || submitLock.current) return; submitLock.current = true; setPending(true); setError(""); setMessage(""); try { await api("/users", { method: "POST", body: JSON.stringify({ name: name.trim(), login: login.trim(), password, role: newRole }) }, token); setName(""); setLogin(""); setPassword(""); setNewRole("VENDEDOR"); setCreateOpen(false); setPage(1); setMessage("Usuário criado com sucesso."); await load(); } catch (reason) { fail(reason); } finally { submitLock.current = false; setPending(false); } }
  function openEdit(person: ManagedUser) { setEditing(person); setEditName(person.name); setEditLogin(person.login); setEditRole(person.role); }
  async function update(event: FormEvent) { event.preventDefault(); if (!editing || pending || submitLock.current) return; const changedIdentity = editName.trim() !== editing.name || editLogin.trim() !== editing.login; const changedRole = editRole !== editing.role; if ((changedIdentity || changedRole) && !window.confirm(`Confirma salvar as alterações de ${editing.name}? Mudanças de login ou papel encerram a sessão desta conta.`)) return; submitLock.current = true; setPending(true); setError(""); setMessage(""); try { await api(`/users/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: editName.trim(), login: editLogin.trim(), role: editRole }) }, token); setEditing(null); setMessage("Usuário atualizado."); await load(); } catch (reason) { fail(reason); } finally { submitLock.current = false; setPending(false); } }
  async function toggleStatus(event: FormEvent) { event.preventDefault(); if (!statusTarget || pending || submitLock.current) return; submitLock.current = true; setPending(true); setError(""); setMessage(""); try { await api(`/users/${statusTarget.id}/status`, { method: "PATCH", body: JSON.stringify({ active: !statusTarget.active, reason: statusReason.trim() }) }, token); setStatusTarget(null); setStatusReason(""); setMessage("Status atualizado com sucesso."); await load(); } catch (reason) { fail(reason); } finally { submitLock.current = false; setPending(false); } }
  async function resetPassword(event: FormEvent) { event.preventDefault(); if (!resetTarget || pending || submitLock.current) return; if (resetPasswordValue !== resetConfirm) { setError("As senhas não coincidem."); return; } submitLock.current = true; setPending(true); setError(""); setMessage(""); try { await api(`/users/${resetTarget.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: resetPasswordValue }) }, token); setResetTarget(null); setResetPasswordValue(""); setResetConfirm(""); setMessage("Senha redefinida. Sessões anteriores encerradas."); await load(); } catch (reason) { fail(reason); } finally { submitLock.current = false; setPending(false); } }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <><section className="card"><div className="card-heading"><div><h2>Usuários da equipe</h2><p>Administre contas individuais e níveis de acesso.</p></div><button className="primary" onClick={() => { setError(""); setCreateOpen(true); }}>Cadastrar usuário</button></div>{error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}</section>
  <section className="card"><div className="users-filters"><label>Buscar nome ou login<input placeholder="Digite para buscar" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} /></label><label>Papel<select value={role} onChange={(event) => { setPage(1); setRole(event.target.value); }}><option value="">Todos</option><option value="ADMIN">ADMIN</option><option value="VENDEDOR">VENDEDOR</option></select></label><label>Status<select value={active} onChange={(event) => { setPage(1); setActive(event.target.value); }}><option value="">Todos</option><option value="true">Ativos</option><option value="false">Inativos</option></select></label></div><div className="card-heading users-list-heading"><div><h2>Usuários cadastrados</h2><p>{total} resultado(s)</p></div><span className="badge">Página {page} de {totalPages}</span></div>
  <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Login</th><th>Papel</th><th>Status</th><th>Criado em</th><th>Atualizado em</th><th>Ações</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td>{person.name}</td><td className="code">{person.login}</td><td>{person.role}</td><td><span className={`user-state ${person.active ? "is-active" : "is-inactive"}`}>{person.active ? "Ativo" : "Inativo"}</span></td><td>{formatDate(person.createdAt)}</td><td>{formatDate(person.updatedAt)}</td><td><div className="user-actions"><button disabled={pending} onClick={() => openEdit(person)}>Editar</button><button disabled={pending} onClick={() => { setStatusTarget(person); setStatusReason(""); }}>{person.active ? "Inativar" : "Ativar"}</button><button disabled={pending} onClick={() => { setResetTarget(person); setResetPasswordValue(""); setResetConfirm(""); }}>Redefinir senha</button></div></td></tr>)}</tbody></table>{loading && <div className="empty" role="status">Carregando usuários…</div>}{!loading && !users.length && <div className="empty">Nenhum usuário encontrado.</div>}</div><div className="pagination"><span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}` : "0 resultados"}</span><div><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Próxima</button></div></div></section>
  {createOpen && <Modal title="Cadastrar usuário" onClose={() => { if (!pending) { setCreateOpen(false); setName(""); setLogin(""); setPassword(""); } }}><form className="dialog-form" onSubmit={create}><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" /></label><label>Login<input value={login} onChange={(event) => setLogin(event.target.value)} required maxLength={120} autoCapitalize="none" autoComplete="username" /></label><label>Papel<select value={newRole} onChange={(event) => setNewRole(event.target.value as "ADMIN" | "VENDEDOR")}><option value="VENDEDOR">VENDEDOR</option><option value="ADMIN">ADMIN</option></select></label><label>Senha inicial<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" /><small>Mínimo de 12 caracteres. Não será exibida após o cadastro.</small></label>{error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={pending} onClick={() => { setCreateOpen(false); setName(""); setLogin(""); setPassword(""); }}>Cancelar</button><button className="primary" type="submit" disabled={pending}>{pending ? "Salvando…" : "Criar usuário"}</button></div></form></Modal>}
  {editing && <Modal title={`Editar ${editing.name}`} onClose={() => !pending && setEditing(null)}><form className="dialog-form" onSubmit={update}><label>Nome<input value={editName} onChange={(event) => setEditName(event.target.value)} required maxLength={120} /></label><label>Login<input value={editLogin} onChange={(event) => setEditLogin(event.target.value)} required maxLength={120} autoCapitalize="none" /></label><label>Papel<select value={editRole} onChange={(event) => setEditRole(event.target.value as "ADMIN" | "VENDEDOR")}><option value="VENDEDOR">VENDEDOR</option><option value="ADMIN">ADMIN</option></select></label>{error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={pending} onClick={() => setEditing(null)}>Cancelar</button><button className="primary" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar alterações"}</button></div></form></Modal>}
  {statusTarget && <Modal title={`${statusTarget.active ? "Inativar" : "Ativar"} usuário`} onClose={() => !pending && setStatusTarget(null)}><form className="dialog-form" onSubmit={toggleStatus}><p>Confirme a alteração de <strong>{statusTarget.name}</strong>. O motivo será registrado na auditoria.</p><label>Motivo<textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} required minLength={3} maxLength={500} rows={3} /></label>{error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={pending} onClick={() => setStatusTarget(null)}>Cancelar</button><button className="primary" type="submit" disabled={pending || statusReason.trim().length < 3}>{pending ? "Salvando…" : `Confirmar ${statusTarget.active ? "inativação" : "ativação"}`}</button></div></form></Modal>}
  {resetTarget && <Modal title={`Redefinir senha de ${resetTarget.name}`} onClose={() => { if (!pending) { setResetTarget(null); setResetPasswordValue(""); setResetConfirm(""); } }}><form className="dialog-form" onSubmit={resetPassword}><p>A senha será enviada uma vez e as sessões atuais serão encerradas.</p><label>Nova senha<input type="password" value={resetPasswordValue} onChange={(event) => setResetPasswordValue(event.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" /></label><label>Confirmar nova senha<input type="password" value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" /></label>{error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={pending} onClick={() => { setResetTarget(null); setResetPasswordValue(""); setResetConfirm(""); }}>Cancelar</button><button className="primary" type="submit" disabled={pending}>{pending ? "Redefinindo…" : "Redefinir senha"}</button></div></form></Modal>}
  </>;
}
function OwnPasswordDialog({ token, onClose, onSuccess }: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const submitLock = useRef(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (pending || submitLock.current) return; if (next !== confirm) { setError("As senhas não coincidem."); return; } submitLock.current = true; setPending(true); setError(""); try { await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword: next }) }, token); setCurrentPassword(""); setNext(""); setConfirm(""); onSuccess(); } catch (reason) { setError(reason instanceof ApiError && reason.status === 401 ? "Sessão expirada ou senha atual incorreta. Confira os dados e entre novamente." : reason instanceof Error ? reason.message : "Falha ao alterar a senha."); } finally { submitLock.current = false; setPending(false); } }
  return <Modal title="Trocar minha senha" onClose={() => !pending && onClose()}><form className="dialog-form" onSubmit={submit}><label>Senha atual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" /></label><label>Nova senha<input type="password" value={next} onChange={(event) => setNext(event.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" /><small>Mínimo de 12 caracteres.</small></label><label>Confirmar nova senha<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={12} maxLength={200} autoComplete="new-password" /></label>{error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={pending} onClick={onClose}>Cancelar</button><button className="primary" disabled={pending}>{pending ? "Alterando…" : "Alterar senha"}</button></div></form></Modal>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button type="button" aria-label="Fechar" onClick={onClose}>×</button></div>{children}</section></div>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
function Dashboard({ token, onNavigate }: { token: string; onNavigate: (section: "products" | "balances") => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([api<{ data: Product[] }>("/products?limit=100", {}, token), api<{ data: Balance[] }>("/balances", {}, token)])
    .then(([productResult, balanceResult]) => { setProducts(productResult.data); setBalances(balanceResult.data); }).catch((reason) => setError(reason.message)); }, [token]);
  return <><section className="stat-grid"><article><span>Produtos ativos</span><strong>{products.length}</strong><small>no catálogo carregado</small></article><article><span>Balanços em andamento</span><strong>{balances.length}</strong><small>abertos ou em revisão</small></article><article><span>Itens em contagem</span><strong>{balances.reduce((total, balance) => total + balance.itemCount, 0)}</strong><small>nos balanços ativos</small></article></section>
    {error && <div className="error">{error}</div>}<section className="card welcome"><div><span className="eyebrow">PRÓXIMO PASSO</span><h2>Prepare seu primeiro balanço</h2><p>Cadastre ou importe os produtos, revise o catálogo e abra um balanço com a referência congelada.</p></div><div className="actions"><button className="primary" onClick={() => onNavigate("products")}>Cadastrar produtos</button><button onClick={() => onNavigate("balances")}>Ver balanços</button></div></section></>;
}

function Products({ token }: { token: string }) {
  const [showImport, setShowImport] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [productName, setProductName] = useState("");
  const [unit, setUnit] = useState("UN");
  const [categoryId, setCategoryId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editDraft, setEditDraft] = useState({ internalCode: "", name: "", unit: "UN", categoryId: "", barcode: "" });
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);
  const [deleteCategoryPassword, setDeleteCategoryPassword] = useState("");
  const [productActionPending, setProductActionPending] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [productResult, categoryResult] = await Promise.all([fetchAllProducts(token, query), api<{ data: Category[] }>("/categories", {}, token)]);
      setProducts(productResult);
      setCategories(categoryResult.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar o catálogo."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);
  async function createCategory(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/categories", { method: "POST", body: JSON.stringify({ name: categoryName }) }, token);
      setCategoryName("");
      await load();
      setMessage("Categoria criada.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao criar categoria.");
    }
  }
  async function createProduct(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const product = await api<Product>("/products", {
        method: "POST",
        body: JSON.stringify({ internalCode, name: productName, unit, categoryId })
      }, token);
      if (photoFile) {
        const photo = new FormData();
        photo.append("photo", photoFile);
        try { await api(`/products/${product.id}/photo`, { method: "POST", body: photo }, token); }
        catch (reason) {
          await load();
          setPhotoFile(null);
          setMessage(`Produto cadastrado, mas a foto não foi enviada: ${reason instanceof Error ? reason.message : "falha no envio."}`);
          return;
        }
      }
      if (barcode.trim()) {
        await api(`/products/${product.id}/identifiers`, {
          method: "POST",
          body: JSON.stringify({ type: "BARCODE", value: barcode.trim() })
        }, token);
      }
      setInternalCode("");
      setProductName("");
      setUnit("UN");
      setCategoryId("");
      setBarcode("");
      setPhotoFile(null);
      await load();
      setMessage("Produto cadastrado com sucesso.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao cadastrar produto.");
    }
  }
  function beginEditProduct(product: Product) {
    setEditingProduct(product);
    setEditDraft({
      internalCode: product.internalCode,
      name: product.name,
      unit: product.unit,
      categoryId: product.category.id,
      barcode: product.identifiers?.find((identifier) => identifier.type === "BARCODE")?.normalizedValue ?? ""
    });
    setEditPhoto(null);
    setError("");
  }
  function closeEditProduct() {
    if (productActionPending) return;
    setEditingProduct(null);
    setEditPhoto(null);
  }
  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!editingProduct || productActionPending) return;
    setProductActionPending(true);
    setError("");
    setMessage("");
    let photoUploadError = "";
    try {
      await api<Product>(`/products/${editingProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify(editDraft)
      }, token);
      if (editPhoto) {
        const photo = new FormData();
        photo.append("photo", editPhoto);
        try { await api(`/products/${editingProduct.id}/photo`, { method: "POST", body: photo }, token); }
        catch (reason) { photoUploadError = reason instanceof Error ? reason.message : "Falha ao enviar a foto."; }
      }
      setEditingProduct(null);
      setEditPhoto(null);
      await load();
      setMessage(photoUploadError
        ? `Dados do produto atualizados, mas a foto não foi enviada: ${photoUploadError}`
        : "Produto atualizado com sucesso.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar o produto.");
    } finally { setProductActionPending(false); }
  }
  function beginEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryDraft(category.name);
    setError("");
  }
  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!editingCategory || productActionPending) return;
    setProductActionPending(true);
    setError("");
    setMessage("");
    try {
      await api<Category>(`/categories/${editingCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: categoryDraft })
      }, token);
      setEditingCategory(null);
      await load();
      setMessage("Categoria atualizada com sucesso.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar a categoria.");
    } finally { setProductActionPending(false); }
  }
  async function deleteCategory(event: FormEvent) {
    event.preventDefault();
    if (!deleteCategoryTarget || productActionPending) return;
    setProductActionPending(true);
    setError("");
    setMessage("");
    try {
      await api(`/categories/${deleteCategoryTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ currentPassword: deleteCategoryPassword })
      }, token);
      setDeleteCategoryTarget(null);
      setDeleteCategoryPassword("");
      await load();
      setMessage("Categoria excluída com sucesso.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao excluir a categoria.");
    } finally { setProductActionPending(false); }
  }
  async function deleteProduct(event: FormEvent) {
    event.preventDefault();
    if (!deleteTarget || productActionPending) return;
    if (deleteConfirmation !== "EXCLUIR") {
      setError('Digite EXCLUIR para confirmar a remoção do produto.');
      return;
    }
    setProductActionPending(true);
    setError("");
    setMessage("");
    try {
      await api(`/products/${deleteTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ currentPassword: deletePassword })
      }, token);
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setDeletePassword("");
      setDeleteConfirmation("");
      setSelectedLabels((current) => current.filter((id) => id !== deletedId));
      await load();
      setMessage("Produto removido do catálogo. Os balanços e relatórios anteriores foram preservados.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao remover o produto.");
    } finally { setProductActionPending(false); }
  }
  async function printQrLabel(product: Product) {
    setError("");
    try {
      const label = await fetchQrLabels([product], token);
      printQrSheets(label, `Etiqueta QR · ${product.name}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao preparar etiqueta.");
    }
  }
  async function printProducts(productsToPrint: Product[], title: string) {
    if (productsToPrint.length === 0) return;
    setError("");
    try {
      const labels = await fetchQrLabels(productsToPrint, token);
      printQrSheets(labels, title);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao preparar as etiquetas selecionadas.");
    }
  }
  async function printCategory(category: Category, categoryProducts: Product[]) {
    if (categoryProducts.length === 0) return;
    await printProducts(categoryProducts, `Etiquetas QR · ${category.name}`);
  }
  async function regenerateQr(product: Product) {
    if (!window.confirm(`Gerar um novo QR para ${product.name}? O QR anterior será revogado e deixará de ser válido.`)) return;
    try {
      await api(`/products/${product.id}/identifiers/qr`, { method: "POST" }, token);
      setMessage(`QR regenerado para ${product.name}. Imprima a nova etiqueta.`);
      await printQrLabel(product);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao regenerar QR."); }
  }
  return <><section className="toolbar"><input placeholder="Pesquisar por código ou nome..." value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} /><button onClick={() => void load()}>Pesquisar</button><form className="inline-form" onSubmit={createCategory}><input placeholder="Nova categoria" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required /><button type="submit">Criar categoria</button></form></section>
    {error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}
    <section className="card"><div className="card-heading"><div><h2>Cadastrar produto</h2><p>Inclua produtos manualmente ou importe vários de uma vez.</p></div><button type="button" onClick={() => setShowImport((open) => !open)}>{showImport ? "Fechar importação" : "Importar catálogo"}</button></div><form className="product-form" onSubmit={createProduct}>
      <label>Código interno<input value={internalCode} onChange={(event) => setInternalCode(event.target.value)} required maxLength={120} /></label>
      <label>Nome do produto<input value={productName} onChange={(event) => setProductName(event.target.value)} required maxLength={200} /></label>
      <label>Unidade<select value={unit} onChange={(event) => setUnit(event.target.value)}><option value="UN">UN</option><option value="CX">CX</option><option value="MT">MT</option><option value="ROLO">ROLO</option><option value="PAR">PAR (solado 34–40)</option></select></label>
      <label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Selecione...</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Código de barras (opcional)<input value={barcode} onChange={(event) => setBarcode(event.target.value)} maxLength={120} /></label>
      <label>Foto do produto (opcional)<input key={photoFile ? "photo-selected" : "photo-empty"} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)} /><small>{photoFile ? photoFile.name : "JPEG, PNG ou WebP · até 5 MB"}</small></label>
      <button className="primary" type="submit" disabled={!categoryId}>Cadastrar produto</button>
    </form></section>
    {showImport && <ImportProducts token={token} onImported={() => void load()} />}
    <section className="card"><div className="card-heading"><div><h2>Catálogo por categoria</h2><p>{products.length} produtos em {categories.length} pastas</p></div><span className="badge">{categories.length} categorias</span></div><div className="catalog-toolbar"><button disabled={selectedLabels.length === 0 || loading} onClick={() => void printProducts(products.filter((product) => selectedLabels.includes(product.id)), "Etiquetas QR selecionadas")}>Imprimir selecionados ({selectedLabels.length})</button><button onClick={() => void load()} disabled={loading}>{loading ? "Atualizando…" : "Atualizar catálogo"}</button></div>{loading && products.length === 0 ? <div className="empty" role="status">Carregando pastas do catálogo…</div> : categories.map((category) => {
      const categoryProducts = products.filter((product) => product.category.id === category.id);
      const expanded = openCategory === category.id;
      return <section className={`category-folder ${expanded ? "is-open" : ""}`} key={category.id}><div className="folder-heading"><button className="folder-toggle" aria-expanded={expanded} onClick={() => setOpenCategory(expanded ? null : category.id)}><span className="folder-icon" aria-hidden="true">{expanded ? "▾" : "▸"}</span><span className="folder-name">{category.name}</span><span className="badge">{categoryProducts.length} produtos</span></button><div className="product-actions"><button disabled={productActionPending} onClick={() => beginEditCategory(category)}>Editar categoria</button><button disabled={productActionPending} className="danger-solid" onClick={() => { setDeleteCategoryTarget(category); setDeleteCategoryPassword(""); setError(""); }}>Excluir categoria</button><button disabled={!categoryProducts.length || loading} onClick={() => void printCategory(category, categoryProducts)}>Imprimir QR da categoria</button></div></div>{expanded && <div className="table-wrap"><table><thead><tr><th>QR</th><th>Código interno</th><th>Produto</th><th>Unidade</th><th>Ações</th></tr></thead><tbody>{categoryProducts.map((product) => <tr key={product.id}><td><input type="checkbox" aria-label={`Selecionar etiqueta de ${product.name}`} checked={selectedLabels.includes(product.id)} onChange={(event) => setSelectedLabels((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /></td><td className="code">{product.internalCode}</td><td>{product.name}</td><td><span className="unit">{product.unit}</span></td><td><div className="product-actions"><button disabled={productActionPending} onClick={() => beginEditProduct(product)}>Editar</button><button disabled={productActionPending} className="danger-solid" onClick={() => { setDeleteTarget(product); setDeletePassword(""); setDeleteConfirmation(""); setError(""); }}>Excluir</button><button onClick={() => void printQrLabel(product)}>Imprimir QR</button><button onClick={() => void regenerateQr(product)}>Regenerar QR</button></div></td></tr>)}</tbody></table>{categoryProducts.length === 0 && <div className="empty">Esta pasta ainda não tem produtos.</div>}</div>}</section>;
    })}{!loading && categories.length === 0 && <div className="empty">Nenhuma categoria cadastrada.</div>}</section>
    {editingProduct && <Modal title={`Editar produto · ${editingProduct.name}`} onClose={closeEditProduct}><form className="dialog-form" onSubmit={saveProduct}>
      <label>Código interno<input value={editDraft.internalCode} onChange={(event) => setEditDraft({ ...editDraft, internalCode: event.target.value })} maxLength={120} required /></label>
      <label>Nome do produto<input value={editDraft.name} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} maxLength={200} required /></label>
      <label>Unidade<select value={editDraft.unit} onChange={(event) => setEditDraft({ ...editDraft, unit: event.target.value })}><option value="UN">UN</option><option value="CX">CX</option><option value="MT">MT</option><option value="ROLO">ROLO</option><option value="PAR">PAR (solado 34–40)</option></select></label>
      <label>Categoria<select value={editDraft.categoryId} onChange={(event) => setEditDraft({ ...editDraft, categoryId: event.target.value })} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Código de barras<input value={editDraft.barcode} onChange={(event) => setEditDraft({ ...editDraft, barcode: event.target.value })} maxLength={255} /><small>Deixe vazio para remover o código de barras atual.</small></label>
      <label>Trocar foto do produto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setEditPhoto(event.target.files?.[0] ?? null)} /><small>{editPhoto ? editPhoto.name : editingProduct.photoUrl ? "Selecione uma foto para substituir a atual." : "Sem foto cadastrada. JPEG, PNG ou WebP · até 5 MB."}</small></label>
      {error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={productActionPending} onClick={closeEditProduct}>Cancelar</button><button className="primary" disabled={productActionPending}>{productActionPending ? "Salvando…" : "Salvar alterações"}</button></div>
    </form></Modal>}
    {editingCategory && <Modal title={`Editar categoria · ${editingCategory.name}`} onClose={() => !productActionPending && setEditingCategory(null)}><form className="dialog-form" onSubmit={saveCategory}>
      <label>Nome da categoria<input value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} maxLength={120} required /></label>
      {error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={productActionPending} onClick={() => setEditingCategory(null)}>Cancelar</button><button className="primary" disabled={productActionPending}>{productActionPending ? "Salvando…" : "Salvar alterações"}</button></div>
    </form></Modal>}
    {deleteCategoryTarget && <Modal title={`Excluir categoria · ${deleteCategoryTarget.name}`} onClose={() => !productActionPending && setDeleteCategoryTarget(null)}><form className="dialog-form" onSubmit={deleteCategory}>
      <p>A categoria só poderá ser excluída se não possuir produtos nem estiver vinculada a balanços.</p>
      <label>Senha do administrador<input type="password" value={deleteCategoryPassword} onChange={(event) => setDeleteCategoryPassword(event.target.value)} autoComplete="current-password" required /></label>
      {error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={productActionPending} onClick={() => setDeleteCategoryTarget(null)}>Cancelar</button><button className="danger-solid" disabled={productActionPending}>{productActionPending ? "Excluindo…" : "Excluir categoria"}</button></div>
    </form></Modal>}
    {deleteTarget && <Modal title={`Excluir produto · ${deleteTarget.name}`} onClose={() => { if (!productActionPending) { setDeleteTarget(null); setDeletePassword(""); setDeleteConfirmation(""); } }}><form className="dialog-form" onSubmit={deleteProduct}>
      <p>O produto será retirado do catálogo e seus QR Codes serão desativados. Balanços e relatórios anteriores serão preservados.</p>
      <label>Senha do administrador<input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" required /></label>
      <label>Digite EXCLUIR para confirmar<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" required /></label>
      {error && <div className="error" role="alert">{error}</div>}<div className="dialog-actions"><button type="button" disabled={productActionPending} onClick={() => { setDeleteTarget(null); setDeletePassword(""); setDeleteConfirmation(""); }}>Cancelar</button><button className="danger-solid" disabled={productActionPending}>{productActionPending ? "Excluindo…" : "Excluir produto"}</button></div>
    </form></Modal>}
    </>;
}

function sizeGridHtml(items: BalanceReportItem[]) {
  const rows = sizeGridRows(items);
  if (!rows.length) return "";
  return `<table class="grid-table"><thead><tr><th>Referência (pares)</th>${SOLE_SIZES.map((size) => `<th>${size}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.product.name)}<div class=code>${escapeHtml(row.product.internalCode)}</div></td>${SOLE_SIZES.map((size) => `<td>${escapeHtml(row.quantities[size] ?? "—")}</td>`).join("")}<td><b>${row.total}</b></td></tr>`).join("")}</tbody></table>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
}

async function fetchAllProducts(token: string, query = "", categoryId?: string) {
  const all: Product[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (query.trim()) params.set("q", query.trim());
    if (categoryId) params.set("categoryId", categoryId);
    const page = await api<{ data: Product[] }>(`/products?${params}`, {}, token);
    all.push(...page.data);
    if (page.data.length < limit) return all;
  }
}

async function fetchAllActiveSellers(token: string) {
  const sellers: ManagedUser[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await api<{ data: ManagedUser[]; total: number }>(`/users?role=VENDEDOR&active=true&page=${page}&limit=100`, {}, token);
    sellers.push(...result.data);
    total = result.total;
    page += 1;
  } while (sellers.length < total);
  return sellers;
}

async function fetchQrLabels(products: Product[], token: string) {
  const labels: { product: Product; identifier: { value: string }; svg: string }[] = [];
  for (let offset = 0; offset < products.length; offset += 20) {
    const batch = products.slice(offset, offset + 20);
    labels.push(...await Promise.all(batch.map((product) => api<{ product: Product; identifier: { value: string }; svg: string }>(`/products/${product.id}/qr-label`, {}, token))));
  }
  return labels;
}

function printQrSheets(labels: { product: Product; identifier: { value: string }; svg: string }[], title: string) {
  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) throw new Error("Permita janelas pop-up para imprimir as etiquetas.");
  const pages: string[] = [];
  for (let offset = 0; offset < labels.length; offset += 20) {
    const sheetLabels = labels.slice(offset, offset + 20);
    const cells = sheetLabels.map((label) => `<article class="label">${label.svg}<div class="name">${escapeHtml(label.product.name)}</div><div class="code">${escapeHtml(label.product.internalCode)}</div><div class="unit">${escapeHtml(label.product.unit)}</div></article>`).join("");
    pages.push(`<section class="sheet">${cells}</section>`);
  }
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111}.sheet{width:200mm;height:287mm;display:grid;grid-template-columns:repeat(4,50mm);grid-template-rows:repeat(5,57.4mm);page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}.label{width:50mm;height:57.4mm;border:0.25mm dashed #bbb;padding:2mm 2mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;break-inside:avoid}.label svg{width:34mm;height:34mm;flex:0 0 34mm}.name{width:100%;font-size:8pt;font-weight:700;line-height:1.15;margin-top:1mm;overflow-wrap:anywhere;max-height:7mm;overflow:hidden}.code{font-family:monospace;font-size:7pt;margin-top:0.5mm}.unit{font-size:6.5pt;color:#444;margin-top:0.3mm}@media screen{body{background:#e6eae7}.sheet{background:#fff;margin:8mm auto;box-shadow:0 1mm 5mm #0002}}@media print{.label{border-color:#ddd}}</style></head><body>${pages.join("")}<script>window.onload=()=>window.print()</script></body></html>`);
  printWindow.document.close();
}

function ImportProducts({ token, onImported }: { token: string; onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [mappingText, setMappingText] = useState('{"internalCode":"codigo","name":"nome","category":"categoria","unit":"unidade","referenceQuantity":"saldo","barcode":"barcode"}');
  const [preview, setPreview] = useState<{ batchId: string; fileHash: string; total: number; valid: number; invalid: number; rows: { line: number; internalCode: string; errors: string[] }[] } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function previewFile() { if (!file) return; setError(""); setMessage(""); try { const form = new FormData(); form.append("file", file); form.append("mapping", mappingText); const result = await api<typeof preview>("/products/import/preview", { method: "POST", body: form }, token); setPreview(result); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na prévia."); } }
  async function confirm() { if (!preview) return; try { const result = await api<{ created: number; updated: number; total: number }>("/products/import/confirm", { method: "POST", body: JSON.stringify({ batchId: preview.batchId, fileHash: preview.fileHash }) }, token); setMessage(`${result.total} linhas confirmadas: ${result.created} criadas e ${result.updated} atualizadas.`); setPreview(null); onImported?.(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha na confirmação."); } }
  return <><section className="card import-card"><span className="eyebrow">ETAPA 1</span><h2>Enviar planilha</h2><p>Use CSV UTF-8 ou XLSX. A prévia não grava dados no catálogo.</p><input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><label>Mapeamento das colunas (JSON)<textarea value={mappingText} onChange={(event) => setMappingText(event.target.value)} rows={5} /></label><button className="primary" disabled={!file} onClick={() => void previewFile()}>Gerar prévia</button></section>
    {error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}{preview && <section className="card"><div className="card-heading"><div><span className="eyebrow">ETAPA 2</span><h2>Revisar prévia</h2></div><div className="preview-stats"><strong>{preview.valid}</strong> válidas <strong className={preview.invalid ? "danger-text" : ""}>{preview.invalid}</strong> com erro</div></div><div className="table-wrap"><table><thead><tr><th>Linha</th><th>Código</th><th>Erros</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.line}><td>{row.line}</td><td className="code">{row.internalCode}</td><td>{row.errors.length ? <span className="danger-text">{row.errors.join(", ")}</span> : <span className="success-text">OK</span>}</td></tr>)}</tbody></table></div>{preview.invalid === 0 && <button className="primary" onClick={() => void confirm()}>Confirmar importação</button>}</section>}</>;
}

const SOLE_SIZES = [34, 35, 36, 37, 38, 39, 40];
function itemName(item: { product: Product; size?: number | null }) { return item.size ? `${item.product.name} · Nº ${item.size}` : item.product.name; }
// Agrupa os itens de solados por referência, com a quantidade aprovada (ou última contagem) de cada numeração.
function sizeGridRows(items: BalanceReportItem[]) {
  const rows = new Map<string, { product: Product; quantities: Record<number, string> }>();
  for (const item of items) {
    if (!item.size) continue;
    const row = rows.get(item.product.id) ?? { product: item.product, quantities: {} };
    const quantity = item.finalQuantity ?? item.counts[item.counts.length - 1]?.quantity;
    if (quantity !== undefined) row.quantities[item.size] = quantity;
    rows.set(item.product.id, row);
  }
  return [...rows.values()].map((row) => ({ ...row, total: Object.values(row.quantities).reduce((sum, quantity) => sum + Number(quantity), 0) }));
}
function SizeGridTable({ items }: { items: BalanceReportItem[] }) {
  const rows = sizeGridRows(items);
  if (!rows.length) return null;
  return <div className="table-wrap"><table><thead><tr><th>Referência (pares)</th>{SOLE_SIZES.map((size) => <th key={size}>{size}</th>)}<th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.product.id}><td>{row.product.name}<small className="block">{row.product.internalCode}</small></td>{SOLE_SIZES.map((size) => <td key={size}>{row.quantities[size] ?? "—"}</td>)}<td><b>{row.total}</b></td></tr>)}</tbody></table></div>;
}

function BalanceDetailsScreen({ detail, categories, isAdmin, onBack, onOpen, onEdit, onDelete, onAssign, onFinalize, onPrint }: {
  detail: BalanceDetailView;
  categories: Category[];
  isAdmin: boolean;
  onBack: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onFinalize: () => void;
  onPrint: () => void;
}) {
  const { balance, report } = detail;
  return <section className="card balance-detail-screen">
    <div className="card-heading balance-detail-heading">
      <div><button className="detail-back" onClick={onBack}>← Histórico de balanços</button><span className="eyebrow">DETALHES DO BALANÇO</span><h2>{balance.name}</h2><p>Informações, responsáveis, datas e itens deste balanço.</p></div>
      <div className="balance-detail-actions">
        {isAdmin && balance.status === "RASCUNHO" && <button className="primary" disabled={!balance.assignedSellers?.some((seller) => seller.active)} onClick={onOpen}>Abrir balanço</button>}
        {isAdmin && balance.status === "RASCUNHO" && <button onClick={onAssign}>Destinar vendedores</button>}
        {isAdmin && balance.status === "RASCUNHO" && balance.kind === "PERSONALIZADO" && <><button onClick={onEdit}>Editar</button><button className="danger-button" onClick={onDelete}>Excluir</button></>}
        {isAdmin && ["ABERTO", "EM_REVISAO"].includes(balance.status) && <button className="primary" onClick={onFinalize}>Finalizar</button>}
        {isAdmin && <button onClick={onPrint}>Emitir balanço</button>}
      </div>
    </div>
    <div className="detail-meta">
      <div><b>Tipo</b><span>{balance.kind === "CATEGORIA" ? `Categorias · ${(balance.selectedCategories?.length ? balance.selectedCategories.map((category) => category.name) : [categories.find((category) => category.id === balance.categoryId)?.name ?? "—"]).join(", ")}` : "Personalizado"}</span></div>
      <div><b>Status</b><span>{balance.status}</span></div>
      <div><b>Total de itens</b><span>{balance.itemCount}</span></div>
      <div><b>Criado em</b><span>{balance.createdAt ? formatDate(balance.createdAt) : "—"}</span></div>
      <div><b>Aberto em</b><span>{balance.openedAt ? formatDate(balance.openedAt) : "—"}</span></div>
      <div><b>Finalizado em</b><span>{balance.closedAt ? formatDate(balance.closedAt) : "—"}</span></div>
      <div><b>Responsável pela criação</b><span>{report?.balance.createdBy.name ?? balance.createdBy?.name ?? "—"}</span></div>
      <div><b>Vendedores destinados</b><span>{report?.balance.assignedSellers.map((seller) => seller.name).join(", ") || balance.assignedSellers?.map((seller) => seller.name).join(", ") || "—"}</span></div>
      {balance.cancelledAt && <div><b>Cancelado em</b><span>{formatDate(balance.cancelledAt)}</span></div>}
      {balance.cancellationReason && <div><b>Motivo do cancelamento</b><span>{balance.cancellationReason}</span></div>}
    </div>
    {report ? report.categories.length ? report.categories.map((category) => <div className="detail-category" key={category.id}>
      <h3>{category.name} <small>({category.items.length} itens)</small></h3>
      <SizeGridTable items={category.items} />
      <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Referência</th><th>Contagens</th><th>Responsável</th><th>Final</th><th>Estado</th></tr></thead><tbody>{category.items.map((item) => <tr key={item.id}>
        <td className="code">{item.product.internalCode}</td><td>{itemName(item)}</td><td>{item.referenceQuantity}</td>
        <td>{item.counts.length ? item.counts.map((count) => <div className="detail-count" key={count.id}><b>{count.quantity} {item.product.unit}</b> · {formatDate(count.countedAt)}{count.isRecount ? " · recontagem" : ""}</div>) : <span className="muted">Sem contagem</span>}</td>
        <td>{item.counts.length ? item.counts.map((count) => <div className="detail-count" key={count.id}>{count.countedBy.login}</div>) : "—"}</td>
        <td>{item.finalQuantity ?? "—"}</td><td><span className="status">{item.status}</span></td>
      </tr>)}</tbody></table></div>
    </div>) : <div className="empty">Este balanço ainda não possui itens.</div> : <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Referência</th><th>Responsável</th><th>Quantidade</th><th>Data/hora</th><th>Estado</th></tr></thead><tbody>{detail.items?.map((item) => <tr key={item.id}>
      <td>{itemName(item)}<small className="block">{item.product.internalCode}</small></td><td>{item.referenceQuantity}</td>
      <td>{item.counts[0]?.countedBy.name ?? "—"}</td><td>{item.counts[0] ? `${item.counts[0].quantity} ${item.product.unit}` : "—"}</td>
      <td>{item.counts[0] ? formatDate(item.counts[0].countedAt) : "—"}</td><td><span className="status">{item.status}</span>{item.counts[0]?.isRecount ? " · recontagem" : ""}</td>
    </tr>)}</tbody></table></div>}
  </section>;
}

function Balances({ token, user }: { token: string; user: User }) {
  const isAdmin = user.role === "ADMIN";
  const [balances, setBalances] = useState<Balance[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [balanceMode, setBalanceMode] = useState<"choose" | "category" | "custom">("choose");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [editingCustom, setEditingCustom] = useState<Balance | null>(null);
  const [sellers, setSellers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [selectedSellerIds, setSelectedSellerIds] = useState<string[]>([]);
  const [assignmentBalance, setAssignmentBalance] = useState<Balance | null>(null);
  const [assignmentSellerIds, setAssignmentSellerIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<BalanceDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(() => window.location.pathname.match(/^\/balances\/([^/]+)$/)?.[1] ?? null);
  const [loading, setLoading] = useState(false);
  const [balancesReady, setBalancesReady] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [balanceResult, catalog, activeSellers, categoryResult] = await Promise.all([
        api<{ data: Balance[] }>(isAdmin ? "/balances?all=true" : "/balances", {}, token),
        isAdmin ? fetchAllProducts(token) : Promise.resolve([] as Product[]),
        isAdmin ? fetchAllActiveSellers(token) : Promise.resolve([] as ManagedUser[]),
        isAdmin ? api<{ data: Category[] }>("/categories", {}, token) : Promise.resolve({ data: [] as Category[] })
      ]);
      setBalances(balanceResult.data);
      setProducts(catalog);
      setSellers(activeSellers);
      setCategories(categoryResult.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar balanços."); }
    finally { setLoading(false); setBalancesReady(true); }
  };
  useEffect(() => { void load(); }, [token, isAdmin]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const items = Object.entries(selected).filter(([, quantity]) => quantity !== "").map(([productId, referenceQuantity]) => ({ productId, referenceQuantity }));
    try {
      const payload = balanceMode === "category"
        ? { name: categories.filter((category) => selectedCategoryIds.includes(category.id)).map((category) => category.name).join(", ").slice(0, 160), kind: "CATEGORIA", categoryIds: selectedCategoryIds, sellerIds: selectedSellerIds, items: [] }
        : { name, kind: "PERSONALIZADO", categoryIds: selectedCategoryIds, sellerIds: selectedSellerIds, items };
      await api("/balances", { method: "POST", body: JSON.stringify(payload) }, token);
      setName(""); setSelected({}); setSelectedCategoryIds([]); setSelectedSellerIds([]); setBalanceMode("choose"); await load(); setMessage("Rascunho criado e destinado aos vendedores selecionados. Abra o balanço para liberar as contagens.");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao criar balanço."); }
  }
  async function editCustom(balance: Balance) {
    setError(""); setMessage("");
    try {
      const draft = await api<{ id: string; name: string; categoryIds: string[]; items: { productId: string; referenceQuantity: string }[]; assignments: { userId: string }[] }>(`/balances/${balance.id}/draft`, {}, token);
      setEditingCustom(balance); setBalanceMode("custom"); setName(draft.name);
      setSelectedCategoryIds(draft.categoryIds);
      setSelected(Object.fromEntries(draft.items.map((item) => [item.productId, item.referenceQuantity])));
      setSelectedSellerIds(draft.assignments.map((assignment) => assignment.userId));
      leaveDetails();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar balanço personalizado."); }
  }
  async function saveCustom(event: FormEvent) {
    event.preventDefault();
    if (!editingCustom) return create(event);
    const items = Object.entries(selected).filter(([, referenceQuantity]) => referenceQuantity !== "").map(([productId, referenceQuantity]) => ({ productId, referenceQuantity }));
    try {
      await api(`/balances/${editingCustom.id}/custom`, { method: "PUT", body: JSON.stringify({ name, sellerIds: selectedSellerIds, categoryIds: selectedCategoryIds, items }) }, token);
      setEditingCustom(null); setName(""); setSelected({}); setSelectedCategoryIds([]); setSelectedSellerIds([]); setBalanceMode("choose"); await load(); setMessage("Balanço personalizado atualizado.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao atualizar balanço personalizado."); }
  }
  async function deleteCustom(balance: Balance) {
    if (!window.confirm(`Excluir o balanço personalizado “${balance.name}”?`)) return;
    try { await api(`/balances/${balance.id}/custom`, { method: "DELETE" }, token); leaveDetails(); await load(); setMessage("Balanço personalizado excluído."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao excluir balanço personalizado."); }
  }
  async function updateAssignees(event: FormEvent) {
    event.preventDefault();
    if (!assignmentBalance) return;
    setError(""); setMessage("");
    try {
      await api(`/balances/${assignmentBalance.id}/assignees`, { method: "PUT", body: JSON.stringify({ sellerIds: assignmentSellerIds }) }, token);
      setAssignmentBalance(null); setAssignmentSellerIds([]); await load(); setMessage("Vendedores do rascunho atualizados.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao atualizar os vendedores."); }
  }
  async function open(id: string) {
    setError(""); setMessage("");
    try { await api(`/balances/${id}/open`, { method: "POST" }, token); leaveDetails(); await load(); setMessage("Balanço aberto. Os vendedores destinados já podem contar pelo celular."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao abrir balanço."); }
  }
  async function loadDetails(balance: Balance) {
    setDetailLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const report = await api<BalanceReport>(`/balances/${balance.id}/report`, {}, token);
        setDetail({ balance, report });
      } else {
        const result = await api<{ data: BalanceDetailItem[] }>(`/balances/${balance.id}/items`, {}, token);
        setDetail({ balance, items: result.data });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar os detalhes do balanço."); }
    finally { setDetailLoading(false); }
  }
  function showDetails(balance: Balance) {
    window.history.pushState({ balanceDetail: true }, "", `/balances/${balance.id}`);
    setDetail(null);
    setDetailId(balance.id);
  }
  function leaveDetails() {
    if (window.history.state?.balanceDetail) window.history.back();
    else {
      window.history.replaceState({}, "", "/balances");
      setDetailId(null);
      setDetail(null);
    }
  }
  useEffect(() => {
    const syncRoute = () => {
      setDetail(null);
      setDetailId(window.location.pathname.match(/^\/balances\/([^/]+)$/)?.[1] ?? null);
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  useEffect(() => {
    if (!detailId || detail?.balance.id === detailId) return;
    const balance = balances.find((item) => item.id === detailId);
    if (balance) void loadDetails(balance);
    else if (balancesReady) setError("Balanço não encontrado.");
  }, [detailId, balances, detail, balancesReady]);
  async function finalize(balance: Balance) {
    if (!window.confirm(`Finalizar o balanço “${balance.name}”? Itens ainda não contados permanecerão sem contagem.`)) return;
    setError(""); setMessage("");
    try {
      await api(`/balances/${balance.id}/close`, { method: "POST" }, token);
      leaveDetails(); await load(); setMessage(`Balanço “${balance.name}” finalizado.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao finalizar o balanço."); }
  }
  async function printBalance(balance: Balance) {
    setError("");
    try {
      const report = await api<BalanceReport>(`/balances/${balance.id}/report`, {}, token);
      const categorySections = report.categories.map((category) => `<section class="category"><h2>${escapeHtml(category.name)} <small>(${category.items.length} itens)</small></h2>${sizeGridHtml(category.items)}<table class="report-table"><thead><tr><th>Código</th><th>Produto</th><th>Referência</th><th>Contagens</th><th>Responsável</th><th>Final</th><th>Estado</th></tr></thead><tbody>${category.items.map((item) => {
        const counts = item.counts.length ? item.counts.map((count) => `<div class="count ${count.approved ? "approved" : ""}"><b>${escapeHtml(count.quantity)} ${escapeHtml(item.product.unit)}</b> · ${escapeHtml(formatDate(count.countedAt))}${count.isRecount ? " · recontagem" : ""}${count.approved ? " · aprovada" : ""}</div>`).join("") : "<span class=muted>Sem contagem</span>";
        const responsibles = `${item.counts.length ? item.counts.map((count) => `<div class="count ${count.approved ? "approved" : ""}">${escapeHtml(count.countedBy.login)}</div>`).join("") : "<span class=muted>—</span>"}${item.approvedBy ? `<div class="count approved">Aprovação: ${escapeHtml(item.approvedBy.login)}${item.approvedAt ? ` · ${escapeHtml(formatDate(item.approvedAt))}` : ""}</div>` : ""}`;
        return `<tr><td class=code>${escapeHtml(item.product.internalCode)}</td><td>${escapeHtml(itemName(item))}</td><td>${escapeHtml(item.referenceQuantity)}</td><td>${counts}</td><td>${responsibles}</td><td>${escapeHtml(item.finalQuantity ?? "—")}</td><td>${escapeHtml(item.status)}</td></tr>`;
      }).join("")}</tbody></table></section>`).join("");
      const dateValues: [string, string][] = [
        ["Criado em", formatDate(report.balance.createdAt)],
        ["Aberto em", report.balance.openedAt ? formatDate(report.balance.openedAt) : "—"],
        ["Encerrado em", report.balance.closedAt ? formatDate(report.balance.closedAt) : "—"],
        ["Cancelado em", report.balance.cancelledAt ? formatDate(report.balance.cancelledAt) : "—"]
      ];
      const dates = dateValues.map(([label, value]) => `<div><b>${label}</b><span>${escapeHtml(value)}</span></div>`).join("");
      const logoUrl = `${window.location.origin}/brand/atacadista-silva.svg`;
      const page = window.open("", "_blank", "width=1200,height=850");
      if (!page) throw new Error("Permita janelas pop-up para imprimir o relatório.");
      page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório · ${escapeHtml(report.balance.name)}</title><style>@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{font:8pt Arial,sans-serif;color:#17231f;margin:0}.report-header{border-bottom:1.5px solid #176b4d;padding-bottom:3mm;margin-bottom:4mm}.brand{display:flex;align-items:center;gap:8px;margin-bottom:3mm}.brand img{width:105px;height:auto;flex:0 0 auto}.brand small{margin-left:auto;color:#58685f;font-size:7pt}.title-row{display:flex;justify-content:space-between;align-items:start;gap:10px}.title-row h1{font-size:14pt;margin:0 0 2px}.meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 10px;margin-top:6px}.meta-grid div{display:grid;gap:2px;overflow-wrap:anywhere}.meta-grid b{font-size:6.5pt;text-transform:uppercase;color:#53645b;letter-spacing:.03em}.summary{margin-top:6px}.category{margin-top:4mm;break-inside:auto}.category h2{font-size:9pt;background:#eaf5ee;padding:4px 6px;margin:0}.category h2 small{font-size:7pt;font-weight:400;color:#53645b}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:6.5pt}table.report-table th:nth-child(1){width:10%}table.report-table th:nth-child(2){width:21%}table.report-table th:nth-child(3){width:9%}table.report-table th:nth-child(4){width:24%}table.report-table th:nth-child(5){width:15%}table.report-table th:nth-child(6){width:9%}table.report-table th:nth-child(7){width:12%}thead{display:table-header-group}th{text-align:left;text-transform:uppercase;font-size:6pt;color:#46574d;background:#f4f6f4}td,th{border:1px solid #d8e0dc;padding:3px;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}.code{font-family:monospace;white-space:normal;overflow-wrap:anywhere}table.grid-table{margin:2mm 0}table.grid-table th:first-child{width:30%}.count{margin:0 0 2px}.approved{color:#176b4d}.muted{color:#7a8680}.empty{text-align:center;padding:10px;color:#7a8680}@media print{.category h2{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><header class="report-header"><div class="brand"><img src="${logoUrl}" alt="Atacadista Silva"><div class="title-row"><div><h1>Relatório do balanço</h1><strong>${escapeHtml(report.balance.name)}</strong></div><span><b>Status:</b> ${escapeHtml(report.balance.status)}</span></div><small>Gerado em ${escapeHtml(formatDate(report.generatedAt))}</small></div><div class="meta-grid"><div><b>Identificador</b><span>${escapeHtml(report.balance.id)}</span></div><div><b>Responsável pela criação</b><span>${escapeHtml(report.balance.createdBy.name)} (${escapeHtml(report.balance.createdBy.login)})</span></div><div><b>Vendedores destinados</b><span>${escapeHtml(report.balance.assignedSellers.map((seller) => seller.name).join(", ") || "—")}</span></div>${dates}<div><b>Total de itens</b><span>${report.balance.itemCount}</span></div>${report.balance.cancellationReason ? `<div><b>Motivo do cancelamento</b><span>${escapeHtml(report.balance.cancellationReason)}</span></div>` : ""}</div></header>${categorySections || "<div class=empty>Este balanço não possui itens.</div>"}<script>window.onload=()=>window.print()</script></body></html>`);
      page.document.close();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao gerar o relatório do balanço."); }
  }
  const selectedCount = useMemo(() => new Set([...Object.keys(selected), ...products.filter((product) => selectedCategoryIds.includes(product.category.id)).map((product) => product.id)]).size, [selected, selectedCategoryIds, products]);
  const canCount = (balance: Balance) => ["ABERTO", "EM_REVISAO"].includes(balance.status);
  if (detail) return <>
    {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
    <BalanceDetailsScreen detail={detail} categories={categories} isAdmin={isAdmin} onBack={leaveDetails} onOpen={() => void open(detail.balance.id)} onEdit={() => void editCustom(detail.balance)} onDelete={() => void deleteCustom(detail.balance)} onAssign={() => { setAssignmentBalance(detail.balance); setAssignmentSellerIds(detail.balance.assignedSellers?.filter((seller) => seller.active).map((seller) => seller.id) ?? []); leaveDetails(); }} onFinalize={() => void finalize(detail.balance)} onPrint={() => void printBalance(detail.balance)} />
  </>;
  if (detailId) return <section className="card balance-detail-screen"><button className="detail-back" onClick={leaveDetails}>← Histórico de balanços</button><h2>Detalhes do balanço</h2><p>{detailLoading ? "Carregando informações do balanço…" : error || "Não foi possível carregar este balanço."}</p></section>;
  return <>
    {isAdmin && <section className="card"><div className="card-heading"><div><h2>{editingCustom ? "Editar balanço personalizado" : "Criar balanço"}</h2><p>Escolha uma categoria inteira ou monte um balanço personalizado com produtos selecionados.</p></div>{balanceMode === "custom" && <span className="badge">{selectedCount} produtos</span>}</div>
      {balanceMode === "choose" && <div className="balance-mode-grid"><button className="balance-mode-card" onClick={() => setBalanceMode("category")}><span className="mode-icon">▰</span><strong>Balanço por categoria</strong><small>Inclui todos os produtos ativos de uma categoria.</small></button><button className="balance-mode-card" onClick={() => setBalanceMode("custom")}><span className="mode-icon">✳</span><strong>Personalizar balanço</strong><small>Defina um nome e escolha os produtos que farão parte.</small></button></div>}
      {balanceMode !== "choose" && <form onSubmit={saveCustom}><div className="form-actions"><button type="button" onClick={() => { setBalanceMode("choose"); setEditingCustom(null); setName(""); setSelected({}); setSelectedCategoryIds([]); setSelectedSellerIds([]); }}>← Voltar</button></div>
        {balanceMode === "category" ? (
          <fieldset className="seller-picker"><legend>Selecione uma ou mais categorias <span aria-hidden="true">*</span></legend>{categories.map((category) => <label className="seller-option" key={category.id}><input type="checkbox" checked={selectedCategoryIds.includes(category.id)} onChange={(event) => setSelectedCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} /><span>{category.name}<small>{products.filter((product) => product.category.id === category.id).length} produtos ativos</small></span></label>)}</fieldset>
        ) : (
          <>
            <label>Nome do balanço personalizado<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Conferência de bebidas" required /></label>
            <div className="product-picker">
              {categories.map((category) => {
                const categoryProducts = products.filter((product) => product.category.id === category.id);
                const wholeCategory = selectedCategoryIds.includes(category.id);
                const expanded = expandedCategoryIds.includes(category.id);
                return <section className="custom-category-group" key={category.id}>
                  <div className="custom-category-heading">
                    <button type="button" aria-expanded={expanded} onClick={() => setExpandedCategoryIds((current) => expanded ? current.filter((id) => id !== category.id) : [...current, category.id])}>{expanded ? "▾" : "▸"} {category.name} ({categoryProducts.length})</button>
                    <label><input type="checkbox" checked={wholeCategory} onChange={(event) => setSelectedCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} /> Incluir categoria inteira</label>
                  </div>
                  {expanded && <div className="custom-category-products">{categoryProducts.map((product) => {
                    const individual = product.id in selected;
                    return <label className="picker-row" key={product.id}>
                      <input type="checkbox" checked={individual || wholeCategory} disabled={wholeCategory} onChange={(event) => setSelected((current) => {
                        const next = { ...current };
                        if (event.target.checked) next[product.id] = "0"; else delete next[product.id];
                        return next;
                      })} />
                      <span>{product.name}<small>{product.internalCode} · {product.unit === "PAR" ? "PAR · numeração 34 a 40" : product.unit}{wholeCategory ? " · incluído pela categoria" : ""}</small></span>
                      {(individual || wholeCategory) && product.unit !== "PAR" && <input className="quantity" value={selected[product.id] ?? "0"} onChange={(event) => setSelected((current) => ({ ...current, [product.id]: event.target.value }))} aria-label={`Saldo de ${product.name}`} />}
                    </label>;
                  })}</div>}
                </section>;
              })}
            </div>
          </>
        )}
        <fieldset className="seller-picker"><legend>Destinar a vendedores <span aria-hidden="true">*</span></legend>{sellers.length ? sellers.map((seller) => <label className="seller-option" key={seller.id}><input type="checkbox" checked={selectedSellerIds.includes(seller.id)} onChange={(event) => setSelectedSellerIds((current) => event.target.checked ? [...current, seller.id] : current.filter((id) => id !== seller.id))} /><span>{seller.name}<small>{seller.login}</small></span></label>) : <p className="muted">Cadastre e ative ao menos um usuário com papel VENDEDOR antes de criar o balanço.</p>}</fieldset>
        <button className="primary" type="submit" disabled={!sellers.length || !selectedSellerIds.length || (balanceMode === "category" ? !selectedCategoryIds.length : !selectedCount)}>{editingCustom ? "Salvar alterações" : "Criar rascunho"}</button></form>}</section>}
    {error && <div className="error" role="alert">{error}</div>}{message && <div className="success" role="status">{message}</div>}
    {error && <div className="error" role="alert">{error}</div>}
    <section className="card"><div className="card-heading"><div><h2>{isAdmin ? "Histórico de balanços" : "Balanços em andamento"}</h2><p>{isAdmin ? "Abra ou consulte os detalhes de cada balanço." : "Somente balanços destinados a você aparecem aqui."}</p></div><button onClick={() => void load()} disabled={loading}>{loading ? "Carregando…" : "Atualizar"}</button></div><div className="table-wrap"><table><thead><tr>{isAdmin && <th>Tipo</th>}<th>Nome</th><th>Status</th><th>Itens</th>{isAdmin && <><th>Responsável</th><th>Vendedores destinados</th><th>Criado em</th></>}<th>Ações</th></tr></thead><tbody>{balances.map((balance) => <tr key={balance.id}>{isAdmin && <td>{balance.kind === "CATEGORIA" ? `Categorias · ${(balance.selectedCategories?.length ? balance.selectedCategories.map((category) => category.name) : [categories.find((category) => category.id === balance.categoryId)?.name ?? "—"]).join(", ")}` : "Personalizado"}</td>}<td>{balance.name}</td><td><span className="status">{balance.status}</span></td><td>{balance.itemCount}</td>{isAdmin && <><td>{balance.createdBy?.name ?? "—"}</td><td>{balance.assignedSellers?.map((seller) => seller.name).join(", ") || "Sem vendedor"}</td><td>{balance.createdAt ? formatDate(balance.createdAt) : "—"}</td></>}<td className="balance-actions"><button aria-label={`Detalhes do balanço ${balance.name}`} onClick={() => showDetails(balance)}>Detalhes</button></td></tr>)}</tbody></table>{!loading && balances.length === 0 && <div className="empty">Nenhum balanço encontrado.</div>}</div></section>
    {assignmentBalance && <section className="card"><div className="card-heading"><div><h2>Vendedores: {assignmentBalance.name}</h2><p>Um rascunho precisa ter pelo menos um vendedor antes de ser aberto.</p></div><button onClick={() => setAssignmentBalance(null)}>Cancelar</button></div><form onSubmit={(event) => void updateAssignees(event)}><fieldset className="seller-picker"><legend>Vendedores destinados <span aria-hidden="true">*</span></legend>{sellers.map((seller) => <label className="seller-option" key={seller.id}><input type="checkbox" checked={assignmentSellerIds.includes(seller.id)} onChange={(event) => setAssignmentSellerIds((current) => event.target.checked ? [...current, seller.id] : current.filter((id) => id !== seller.id))} /><span>{seller.name}<small>{seller.login}</small></span></label>)}</fieldset><button className="primary" type="submit" disabled={!assignmentSellerIds.length}>Salvar vendedores</button></form></section>}
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);




