import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { canAccess, clearCurrentUser, getCurrentUser } from "../utils/auth";

const menu = [
    { to: "/dashboard", label: "Inicio", icon: "🏠", permission: "dashboard" },
    { to: "/facturacion", label: "Facturación", icon: "🧾", permission: "facturacion" },
    { to: "/ventas", label: "Ventas", icon: "💳", permission: "ventas" },
    { to: "/clientes", label: "Clientes", icon: "👥", permission: "clientes" },
    { to: "/productos", label: "Productos", icon: "📦", permission: "productos" },
    { to: "/inventario", label: "Inventario", icon: "📚", permission: "inventario" },
    { to: "/documentos-dte", label: "Documentos DTE", icon: "📄", permission: "documentosDte" },
    { to: "/pagos", label: "Pagos", icon: "💰", permission: "pagos" },
    { to: "/empresa", label: "Empresa", icon: "🏢", permission: "empresa" },
    { to: "/usuarios", label: "Usuarios", icon: "🔐", permission: "usuarios" },
];

const metaByPath = {
    "/dashboard": { title: "Inicio", description: "Panel operativo del día con accesos rápidos, ventas recientes y alertas para facturar." },
    "/facturacion": { title: "Facturación", description: "Crea ventas con control documental, pago integrado y relación directa con el JSON DTE." },
    "/ventas": { title: "Ventas", description: "Consulta historial, estado de cobro y control documental de cada venta." },
    "/clientes": { title: "Clientes", description: "Administra tus clientes y respeta los permisos del rol que inició sesión." },
    "/productos": { title: "Productos", description: "Catálogo de productos con categorías, unidades y compatibilidad con escáner." },
    "/inventario": { title: "Inventario", description: "Controla existencias, movimientos y kardex desde un solo módulo." },
    "/documentos-dte": { title: "Documentos DTE", description: "Solo administrador y cajero pueden entrar a este módulo documental." },
    "/pagos": { title: "Pagos", description: "Registro y consulta de cobros parciales o totales por método." },
    "/empresa": { title: "Empresa", description: "Configuración fiscal y visual reservada al administrador." },
    "/usuarios": { title: "Usuarios", description: "Gestión de usuarios y roles reservada al administrador." },
};

function MainLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const meta = metaByPath[location.pathname] || metaByPath["/dashboard"];
    const ahora = new Date().toLocaleString("es-SV", { dateStyle: "medium", timeStyle: "short" });
    const usuario = getCurrentUser();
    const menuVisible = menu.filter((item) => canAccess(item.permission, usuario));

    const cerrarSesion = () => {
        clearCurrentUser();
        navigate("/");
    };

    return (
        <div className="layout">
            <aside className="app-sidebar">
                <div className="brand">
                    <img 
  src="/lodo.png" 
  alt="Quanty Management" 
  style={{ 
    width: "80px", 
    height: "auto", 
    objectFit: "contain"
  }}
/>
                    <div className="brand-text">
                        <strong>Quanty Management</strong>
                        <span>Sistema local de gestión y facturación</span>
                    </div>
                </div>

                <div className="sidebar-section">Módulos</div>
                <div className="sidebar-scroll">
                    <ul className="nav-list">
                        {menuVisible.map((item) => (
                            <li key={item.to}>
                                <NavLink
                                    to={item.to}
                                    className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    <span>{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="sidebar-footer cardy">
                    <div>
                        <strong>{usuario?.username || "Invitado"}</strong>
                        <span>{usuario?.rol || "Sin rol"}</span>
                    </div>
                    <button className="btn btn-small btn-secondary" onClick={cerrarSesion}>Salir</button>
                </div>
            </aside>

            <div className="app-main">
                <header className="topbar">
                    <div className="topbar-title">
                        <h1>{meta.title}</h1>
                        <p>{meta.description}</p>
                    </div>

                    <div className="topbar-side">
                        <div className="status-pill"><span className="status-dot"></span>Sistema local activo</div>
                        {usuario?.sucursal_nombre && <div className="pill">{usuario.sucursal_nombre}</div>}
                        {usuario?.ambiente && <div className="pill">{usuario.ambiente === "PRODUCCION" ? "Ambiente productivo" : "Ambiente de prueba"}</div>}
                        {usuario?.rol && <div className="pill">{usuario.rol}</div>}
                        <div className="pill">{ahora}</div>
                    </div>
                </header>
                <main className="page-shell">{children}</main>
            </div>
        </div>
    );
}

export default MainLayout;
