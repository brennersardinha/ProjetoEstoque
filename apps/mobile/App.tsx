import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, ApiError, Balance, BalanceItem, clearToken, getApiUrl, getServerOrigin, getToken, idempotencyKey, login, resolveServer, saveToken, SERVER_NOT_FOUND_MESSAGE, setServerAddress, setUnauthorizedHandler, User } from "./src/api";

type Screen = "balances" | "items" | "scanner" | "count" | "grade";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      try { await clearToken(); }
      finally {
        setToken(null);
        setUser(null);
        setAuthMessage("Sua sessão expirou ou foi encerrada. Entre novamente para continuar.");
      }
    });
    getToken().then(async (stored) => {
      if (!(await resolveServer())) { setAuthMessage(SERVER_NOT_FOUND_MESSAGE); return; }
      if (!stored) return;
      try {
        const result = await api<{ user: User }>("/auth/me", {}, stored);
        setToken(stored);
        setUser(result.user);
      } catch (reason) {
        if (reason instanceof ApiError) await clearToken();
        else setAuthMessage(reason instanceof Error ? reason.message : SERVER_NOT_FOUND_MESSAGE);
      }
    }).catch(() => { setToken(null); setAuthMessage("Não foi possível recuperar a sessão salva. Entre novamente."); }).finally(() => setLoading(false));
    return () => setUnauthorizedHandler(undefined);
  }, []);
  if (loading) return <AppLoadingScreen />;
  if (!token || !user) return <LoginScreen message={authMessage} onLoggedIn={async (newToken, newUser) => { await saveToken(newToken); setAuthMessage(""); setLoading(true); setToken(newToken); setUser(newUser); setTimeout(() => setLoading(false), 450); }} />;
  return <MainScreen token={token} user={user} onLogout={async () => { await clearToken(); setAuthMessage(""); setToken(null); setUser(null); }} />;
}

function AppLoadingScreen() {
  return <SafeAreaView style={styles.loadingPage} accessibilityRole="progressbar" accessibilityLabel="Preparando o sistema">
    <Image source={require("./assets/logo-full.png")} resizeMode="contain" style={styles.loadingLogo} />
    <ActivityIndicator color="#176b4d" size="large" />
    <Text style={styles.loadingText}>Procurando o servidor do estoque…</Text>
  </SafeAreaView>;
}

function LoginScreen({ onLoggedIn, message }: { onLoggedIn: (token: string, user: User) => Promise<void>; message: string }) {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try { const result = await login(loginValue, password); await onLoggedIn(result.token, result.user); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.loginPage}><View style={styles.loginCard}><Text style={styles.eyebrow}>ESTOQUE</Text><Text style={styles.title}>Contagem no celular</Text><Text style={styles.subtitle}>Entre para consultar suas pendências e registrar contagens.</Text><Text style={styles.label}>Usuário</Text><TextInput style={styles.input} value={loginValue} onChangeText={setLoginValue} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" /><Text style={styles.label}>Senha</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={() => { if (!busy && loginValue.trim() && password) void submit(); }} /><ErrorMessage message={message} /><ErrorMessage message={error} /><PrimaryButton title={busy ? "Entrando..." : "Entrar"} onPress={() => void submit()} disabled={busy || !loginValue || !password} /><ServerSettings /></View></SafeAreaView>;
}

function ServerSettings() {
  const [serverUrl, setServerUrl] = useState(getApiUrl());
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search() {
    setBusy(true); setError("");
    try {
      const found = await resolveServer(true);
      setServerUrl(found);
      if (!found) setError(SERVER_NOT_FOUND_MESSAGE);
    } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError("");
    try { setServerUrl(await setServerAddress(address)); setEditing(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível conectar a esse endereço."); }
    finally { setBusy(false); }
  }
  return <View style={styles.serverBox}><Text style={styles.muted}>{busy ? "Procurando servidor na rede…" : serverUrl ? `Servidor: ${serverUrl}` : "Servidor não encontrado"}</Text><View style={styles.headerActions}><Pressable onPress={() => void search()} disabled={busy}><Text style={[styles.link, busy && styles.disabled]}>Procurar novamente</Text></Pressable><Pressable onPress={() => setEditing(!editing)} disabled={busy}><Text style={[styles.link, busy && styles.disabled]}>Informar endereço</Text></Pressable></View>{editing && <View style={styles.manualRow}><TextInput style={[styles.input, styles.manualInput]} value={address} onChangeText={setAddress} placeholder="192.168.0.10" autoCapitalize="none" autoCorrect={false} keyboardType="url" /><Pressable style={[styles.smallButton, (busy || !address.trim()) && styles.disabled]} onPress={() => void save()} disabled={busy || !address.trim()}><Text style={styles.smallButtonText}>Salvar</Text></Pressable></View>}<ErrorMessage message={error} /></View>;
}

function MainScreen({ token, user, onLogout }: { token: string; user: User; onLogout: () => Promise<void> }) {
  const [screen, setScreen] = useState<Screen>("balances");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [items, setItems] = useState<BalanceItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<BalanceItem | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<BalanceItem[]>([]);
  const [error, setError] = useState("");
  async function loadItems(selectedBalance: Balance) {
    setError("");
    try { const result = await api<{ data: BalanceItem[] }>(`/balances/${selectedBalance.id}/items`, {}, token); setBalance(selectedBalance); setItems(result.data); setScreen("items"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar itens."); }
  }
  if (screen === "balances") return <BalancesScreen token={token} user={user} error={error} onSelect={(value) => void loadItems(value)} onLogout={() => void onLogout()} />;
  function openGrade(gradeItems: BalanceItem[]) { setSelectedGrade(gradeItems); setScreen("grade"); }
  if (screen === "scanner") return <ScannerScreen token={token} items={items} onBack={() => setScreen("items")} onResolved={(item) => { setSelectedItem(item); setScreen("count"); }} onResolvedGrade={openGrade} />;
  if (screen === "count" && selectedItem && balance) return <CountScreen token={token} balanceId={balance.id} item={selectedItem} onBack={() => setScreen("items")} onSaved={async () => { await loadItems(balance); }} />;
  if (screen === "grade" && selectedGrade.length && balance) return <GradeCountScreen token={token} balanceId={balance.id} items={selectedGrade} onBack={() => setScreen("items")} onSaved={async () => { await loadItems(balance); }} />;
  return <ItemsScreen balance={balance!} items={items} error={error} onScan={() => setScreen("scanner")} onBack={() => setScreen("balances")} onSelect={(item) => { setSelectedItem(item); setScreen("count"); }} onSelectGrade={openGrade} />;
}

function BalancesScreen({ token, user, error, onSelect, onLogout }: { token: string; user: User; error: string; onSelect: (balance: Balance) => void; onLogout: () => void }) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  async function loadBalances() {
    setLoading(true);
    setLoadError("");
    try { const result = await api<{ data: Balance[] }>("/balances", {}, token); setBalances(result.data); }
    catch (reason) { setLoadError(reason instanceof Error ? reason.message : "Falha ao carregar balanços."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadBalances(); }, [token]);
  return <ScreenLayout title="Balanços" subtitle={`Olá, ${user.name}`} right={<View style={styles.headerActions}><Pressable onPress={() => void loadBalances()} disabled={loading}><Text style={[styles.link, loading && styles.disabled]}>{loading ? "Atualizando…" : "Atualizar"}</Text></Pressable><Pressable onPress={onLogout}><Text style={styles.link}>Sair</Text></Pressable></View>}><ErrorMessage message={error || loadError} />{loading ? <ActivityIndicator color="#176b4d" /> : balances.length === 0 ? <Empty text="Nenhum balanço aberto no momento." /> : balances.map((balance) => <Pressable key={balance.id} style={styles.balanceCard} onPress={() => onSelect(balance)}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{balance.name}</Text><Text style={styles.status}>{balance.status}</Text></View><Text style={styles.muted}>{balance.itemCount} itens · {balance.myCountedItemCount} contados por você</Text></Pressable>)}</ScreenLayout>;
}

// Solados têm um item por numeração; na lista eles aparecem agrupados por referência.
function groupItems(items: BalanceItem[]) {
  const groups: BalanceItem[][] = [];
  const byProduct = new Map<string, BalanceItem[]>();
  for (const item of items) {
    if (!item.size) { groups.push([item]); continue; }
    const group = byProduct.get(item.product.id);
    if (group) group.push(item);
    else { const created = [item]; byProduct.set(item.product.id, created); groups.push(created); }
  }
  return groups;
}

function ItemsScreen({ balance, items, error, onScan, onBack, onSelect, onSelectGrade }: { balance: Balance; items: BalanceItem[]; error: string; onScan: () => void; onBack: () => void; onSelect: (item: BalanceItem) => void; onSelectGrade: (items: BalanceItem[]) => void }) {
  const groups = groupItems(items);
  const pendingCount = groups.filter((group) => group.some((item) => item.status === "PENDENTE")).length;
  return <ScreenLayout title={balance.name} subtitle={`${pendingCount} pendências · ${groups.length} produtos`} left={<Pressable onPress={onBack}><Text style={styles.link}>Voltar</Text></Pressable>}><ErrorMessage message={error} /><PrimaryButton title="Ler QR Code do produto" onPress={onScan} />{groups.length === 0 ? <Empty text="Este balanço não contém produtos." /> : groups.map((group) => {
    const item = group[0]!;
    if (!item.size) return <Pressable key={item.id} style={styles.itemCard} disabled={item.status !== "PENDENTE"} onPress={() => onSelect(item)}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{item.product.name}</Text><Text style={styles.unit}>{item.product.unit}</Text></View><Text style={styles.muted}>{item.product.internalCode} · Ref. {item.referenceQuantity} {item.product.unit} · {item.status}</Text></Pressable>;
    const pendingSizes = group.filter((sizeItem) => sizeItem.status === "PENDENTE").length;
    return <Pressable key={item.product.id} style={styles.itemCard} disabled={pendingSizes === 0} onPress={() => onSelectGrade(group)}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{item.product.name}</Text><Text style={styles.unit}>PAR</Text></View><Text style={styles.muted}>{item.product.internalCode} · Numeração {item.size} a {group[group.length - 1]!.size} · {pendingSizes ? `${pendingSizes} de ${group.length} pendentes` : "CONTADO"}</Text></Pressable>;
  })}</ScreenLayout>;
}

function ScannerScreen({ token, items, onBack, onResolved, onResolvedGrade }: { token: string; items: BalanceItem[]; onBack: () => void; onResolved: (item: BalanceItem) => void; onResolvedGrade: (items: BalanceItem[]) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  async function resolve(value: string) {
    if (busy || !value.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ product: BalanceItem["product"] }>(`/identifiers/resolve?value=${encodeURIComponent(value.trim())}`, {}, token);
      const matches = items.filter((candidate) => candidate.product.id === result.product.id);
      const item = matches[0];
      if (!item) {
        throw new Error("Este produto não pertence ao balanço selecionado ou não está destinado a você.");
      }
      if (item.size) {
        if (!matches.some((sizeItem) => sizeItem.status === "PENDENTE")) throw new Error("Todas as numerações deste solado já foram contadas.");
        onResolvedGrade(matches.map((sizeItem) => ({ ...sizeItem, product: { ...sizeItem.product, ...(result.product.photoUrl !== undefined ? { photoUrl: result.product.photoUrl } : {}) } })));
        return;
      }
      if (item.status !== "PENDENTE") {
        throw new Error("Este item já possui contagem ou está em revisão.");
      }
      onResolved({ ...item, product: { ...item.product, ...(result.product.photoUrl !== undefined ? { photoUrl: result.product.photoUrl } : {}) } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Código não encontrado."); }
    finally { setBusy(false); }
  }
  if (!permission) return <Centered><ActivityIndicator color="#176b4d" /></Centered>;
  if (!permission.granted) return <ScreenLayout title="Acesso à câmera" left={<Pressable onPress={onBack}><Text style={styles.link}>Voltar</Text></Pressable>}><Text style={styles.subtitle}>A câmera é necessária para identificar o produto. A permissão fica somente no aparelho.</Text><PrimaryButton title="Permitir câmera" onPress={() => void requestPermission()} /></ScreenLayout>;
  return <SafeAreaView style={styles.scanner}><View style={styles.scannerHeader}><Pressable onPress={onBack}><Text style={styles.whiteLink}>Voltar</Text></Pressable><Text style={styles.whiteTitle}>Ler identificador</Text></View><View style={styles.cameraBox}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] }} onBarcodeScanned={busy ? undefined : ({ data }) => void resolve(data)} /><View style={styles.scanFrame} /></View><Text style={styles.scanHint}>{busy ? "Consultando servidor..." : "Aponte para o QR Code ou código de barras"}</Text><View style={styles.manualBox}><Text style={styles.label}>Ou digite o código</Text><View style={styles.manualRow}><TextInput style={[styles.input, styles.manualInput]} value={manual} onChangeText={setManual} autoCapitalize="none" /><Pressable style={styles.smallButton} onPress={() => void resolve(manual)}><Text style={styles.smallButtonText}>Buscar</Text></Pressable></View></View><ErrorMessage message={error} /></SafeAreaView>;
}

function CountScreen({ token, balanceId, item, onBack, onSaved }: { token: string; balanceId: string; item: BalanceItem; onBack: () => void; onSaved: () => Promise<void> }) {
  const [quantity, setQuantity] = useState("");
  const [key, setKey] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      const requestKey = key || idempotencyKey();
      if (!key) { setKey(requestKey); setAttempted(true); }
      await api(`/balances/${balanceId}/items/${item.id}/counts`, { method: "POST", headers: { "Idempotency-Key": requestKey }, body: JSON.stringify({ quantity }) }, token);
      Alert.alert("Contagem salva", "O servidor confirmou esta contagem.", [{ text: "Continuar", onPress: () => void onSaved() }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar. Verifique o estado antes de tentar novamente."); }
    finally { setBusy(false); }
  }
  const photoUri = item.product.photoUrl ? `${getServerOrigin()}${item.product.photoUrl.startsWith("/") ? item.product.photoUrl : `/${item.product.photoUrl}`}` : null;
  return <ScreenLayout title="Confirmar contagem" left={<Pressable onPress={onBack}><Text style={styles.link}>Voltar</Text></Pressable>}><View style={styles.productHero}>{photoUri && <Image source={{ uri: photoUri }} style={styles.productPhoto} resizeMode="cover" />}<Text style={styles.eyebrow}>{item.product.category.name}</Text><Text style={styles.heroTitle}>{item.product.name}</Text><Text style={styles.muted}>{item.product.internalCode} · Unidade {item.product.unit}</Text></View><View style={styles.reference}><Text style={styles.muted}>Referência congelada</Text><Text style={styles.referenceValue}>{item.referenceQuantity || "—"} {item.product.unit}</Text></View><Text style={styles.label}>Quantidade física ({item.product.unit})</Text><TextInput style={styles.quantityInput} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="0" autoFocus editable={!attempted} /><ErrorMessage message={error} /><PrimaryButton title={busy ? "Salvando..." : attempted ? "Tentar salvar novamente" : "Confirmar e salvar"} onPress={() => void submit()} disabled={busy || !/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(quantity)} /></ScreenLayout>;
}

function GradeCountScreen({ token, balanceId, items, onBack, onSaved }: { token: string; balanceId: string; items: BalanceItem[]; onBack: () => void; onSaved: () => Promise<void> }) {
  const product = items[0]!.product;
  const pending = items.filter((item) => item.status === "PENDENTE");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  // Cada numeração guarda a própria chave para que uma nova tentativa não duplique contagens já salvas.
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const complete = pending.every((item) => /^(?:0|[1-9]\d*)$/.test(quantities[item.id] ?? ""));
  const total = pending.reduce((sum, item) => sum + (Number(quantities[item.id]) || 0), 0);
  async function submit() {
    setBusy(true); setError("");
    const requestKeys: Record<string, string> = Object.fromEntries(pending.map((item) => [item.id, keys[item.id] ?? idempotencyKey()]));
    setKeys(requestKeys);
    const done = [...saved];
    try {
      for (const item of pending) {
        if (done.includes(item.id)) continue;
        await api(`/balances/${balanceId}/items/${item.id}/counts`, { method: "POST", headers: { "Idempotency-Key": requestKeys[item.id]! }, body: JSON.stringify({ quantity: quantities[item.id] }) }, token);
        done.push(item.id);
      }
      Alert.alert("Grade salva", `O servidor confirmou ${total} pares de ${product.name}.`, [{ text: "Continuar", onPress: () => void onSaved() }]);
    } catch (reason) { setError(`${reason instanceof Error ? reason.message : "Não foi possível salvar."} ${done.length} de ${pending.length} numerações foram salvas; toque em salvar para enviar as restantes.`); }
    finally { setSaved(done); setBusy(false); }
  }
  const photoUri = product.photoUrl ? `${getServerOrigin()}${product.photoUrl.startsWith("/") ? product.photoUrl : `/${product.photoUrl}`}` : null;
  return <ScreenLayout title="Contar grade" left={<Pressable onPress={onBack}><Text style={styles.link}>Voltar</Text></Pressable>}><View style={styles.productHero}>{photoUri && <Image source={{ uri: photoUri }} style={styles.productPhoto} resizeMode="cover" />}<Text style={styles.eyebrow}>{product.category.name}</Text><Text style={styles.heroTitle}>{product.name}</Text><Text style={styles.muted}>{product.internalCode} · Quantidade em pares por numeração</Text></View>{items.map((item) => {
    const editable = item.status === "PENDENTE" && !saved.includes(item.id);
    return <View key={item.id} style={styles.sizeRow}><Text style={styles.sizeLabel}>{item.size}</Text>{editable ? <TextInput style={styles.sizeInput} value={quantities[item.id] ?? ""} onChangeText={(value) => setQuantities((current) => ({ ...current, [item.id]: value }))} keyboardType="number-pad" placeholder="0" editable={!busy} /> : <Text style={styles.sizeDone}>{saved.includes(item.id) ? `${quantities[item.id]} · salvo` : item.status}</Text>}</View>;
  })}<Text style={styles.muted}>Preencha todas as numerações (use 0 quando não houver pares). Total: {total} pares.</Text><ErrorMessage message={error} /><PrimaryButton title={busy ? "Salvando..." : saved.length ? "Tentar salvar novamente" : "Confirmar e salvar grade"} onPress={() => void submit()} disabled={busy || !complete} /></ScreenLayout>;
}

function ScreenLayout({ title, subtitle, left, right, children }: { title: string; subtitle?: string; left?: JSX.Element | null; right?: JSX.Element | null; children: any }) {
  return <SafeAreaView style={styles.page}><View style={styles.header}>{left ?? <View />}<View style={styles.headerCenter}><Text style={styles.headerTitle}>{title}</Text>{subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}</View>{right ?? <View />}</View><ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView></SafeAreaView>;
}
function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) { return <Pressable style={[styles.primaryButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.primaryText}>{title}</Text></Pressable>; }
function ErrorMessage({ message }: { message: string }) { return message ? <Text style={styles.error}>{message}</Text> : null; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.muted}>{text}</Text></View>; }
function Centered({ children }: { children: JSX.Element }) { return <SafeAreaView style={styles.centered}>{children}</SafeAreaView>; }

const styles = StyleSheet.create({
  loginPage: { flex: 1, backgroundColor: "#123b2d", justifyContent: "center", padding: 24 },
  loginCard: { backgroundColor: "#fff", borderRadius: 18, padding: 26 },
  eyebrow: { color: "#35785c", fontSize: 11, fontWeight: "800", letterSpacing: 1.3 },
  title: { color: "#17231f", fontSize: 28, fontWeight: "800", marginTop: 8, marginBottom: 10 },
  subtitle: { color: "#6e7e76", fontSize: 15, lineHeight: 22, marginBottom: 22 },
  label: { color: "#405048", fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 12 },
  input: { borderColor: "#d8e0dc", borderWidth: 1, borderRadius: 9, padding: 12, color: "#17231f", backgroundColor: "#fff" },
  primaryButton: { backgroundColor: "#176b4d", borderRadius: 9, padding: 14, alignItems: "center", marginTop: 18 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  error: { backgroundColor: "#fff0ef", color: "#a43b35", borderRadius: 8, padding: 12, marginTop: 14, overflow: "hidden" },
  page: { flex: 1, backgroundColor: "#f5f7f6" },
  header: { minHeight: 80, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 12, backgroundColor: "#fff", borderBottomColor: "#e5ebe7", borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerCenter: { alignItems: "center", flex: 1 },
  headerTitle: { color: "#17231f", fontSize: 19, fontWeight: "800" },
  headerSubtitle: { color: "#718078", fontSize: 12, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  scroll: { padding: 18, paddingBottom: 40 },
  link: { color: "#176b4d", fontWeight: "700", padding: 8 },
  balanceCard: { backgroundColor: "#fff", padding: 17, borderRadius: 12, borderColor: "#e5ebe7", borderWidth: 1, marginBottom: 12 },
  itemCard: { backgroundColor: "#fff", padding: 16, borderRadius: 11, borderColor: "#e5ebe7", borderWidth: 1, marginTop: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: "#17231f", fontSize: 16, fontWeight: "700", flex: 1 },
  muted: { color: "#718078", fontSize: 13, marginTop: 5 },
  status: { color: "#226443", backgroundColor: "#eaf5ee", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, fontSize: 11, fontWeight: "700" },
  unit: { color: "#226443", backgroundColor: "#eaf5ee", padding: 5, borderRadius: 6, fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", padding: 40 },
  scanner: { flex: 1, backgroundColor: "#111" },
  scannerHeader: { padding: 18, paddingTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  whiteLink: { color: "#fff", fontWeight: "700", padding: 8 },
  whiteTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cameraBox: { height: 390, marginHorizontal: 18, overflow: "hidden", borderRadius: 16, justifyContent: "center", alignItems: "center" },
  scanFrame: { width: 230, height: 160, borderWidth: 2, borderColor: "#a7e36d", borderRadius: 12 },
  scanHint: { color: "#fff", textAlign: "center", margin: 18 },
  manualBox: { margin: 18, backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: { flex: 1 },
  smallButton: { backgroundColor: "#176b4d", borderRadius: 8, justifyContent: "center", paddingHorizontal: 14 },
  smallButtonText: { color: "#fff", fontWeight: "700" },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderColor: "#e5ebe7", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  sizeLabel: { color: "#17231f", fontSize: 20, fontWeight: "800", width: 44 },
  sizeInput: { flex: 1, borderColor: "#176b4d", borderWidth: 2, borderRadius: 8, padding: 10, fontSize: 20, color: "#17231f", textAlign: "center" },
  sizeDone: { flex: 1, color: "#226443", fontWeight: "700", textAlign: "center", padding: 10 },
  serverBox: { borderTopColor: "#e5ebe7", borderTopWidth: 1, marginTop: 22, paddingTop: 10 },
  productHero: { backgroundColor: "#fff", padding: 20, borderRadius: 13, borderColor: "#e5ebe7", borderWidth: 1 },
  productPhoto: { width: "100%", height: 220, borderRadius: 10, marginBottom: 16, backgroundColor: "#eaf0ec" },
  heroTitle: { color: "#17231f", fontSize: 23, fontWeight: "800", marginTop: 7 },
  reference: { backgroundColor: "#eaf5ee", padding: 18, borderRadius: 12, marginTop: 16 },
  referenceValue: { color: "#176b4d", fontSize: 28, fontWeight: "800", marginTop: 4 },
  quantityInput: { backgroundColor: "#fff", borderColor: "#176b4d", borderWidth: 2, borderRadius: 10, padding: 15, fontSize: 28, color: "#17231f", textAlign: "center", marginTop: 4 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f7f6" }
  ,loadingPage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#fff" },
  loadingLogo: { width: 260, height: 260, marginBottom: 20 },
  loadingText: { color: "#53645b", fontSize: 14, marginTop: 16 }
});

