import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginUsuario, obtenerContextoLogin } from "../services/authService";

const contextoInicial = {
    empresa: null,
    sucursales: [],
    ambientes: [
        { codigo: "TEST", nombre: "Ambiente de prueba" },
        { codigo: "PRODUCCION", nombre: "Ambiente productivo" },
    ],
    ambiente_default: "TEST",
};

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [contexto, setContexto] = useState(contextoInicial);
    const [form, setForm] = useState({
        usuario: "",
        password: "",
        sucursal_id: "",
        ambiente: "TEST",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingContexto, setLoadingContexto] = useState(true);

    useEffect(() => {
        const cargarContexto = async () => {
            setLoadingContexto(true);
            try {
                const res = await obtenerContextoLogin();
                if (res.ok) {
                    const data = { ...contextoInicial, ...(res.data || {}) };
                    setContexto(data);
                    setForm((prev) => ({
                        ...prev,
                        sucursal_id: String(data.sucursales?.[0]?.id || ""),
                        ambiente: data.ambiente_default || "TEST",
                    }));
                } else {
                    setError(res.mensaje || "No se pudo cargar el acceso.");
                }
            } catch (err) {
                console.error(err);
                setError("No se pudo cargar el contexto del login.");
            } finally {
                setLoadingContexto(false);
            }
        };
        cargarContexto();
    }, []);

    const nombreEmpresa = useMemo(() => {
        return contexto.empresa?.nombre_comercial || contexto.empresa?.nombre || "Quanty Management";
    }, [contexto.empresa]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await loginUsuario({
                username: form.usuario,
                password: form.password,
                sucursal_id: form.sucursal_id || null,
                ambiente: form.ambiente,
            });
            if (res.ok) {
                localStorage.setItem("qm_usuario", JSON.stringify(res.data));
                navigate(location.state?.from || "/dashboard");
            } else {
                setError(res.mensaje || "No se pudo iniciar sesión.");
            }
        } catch (err) {
            console.error(err);
            setError("No se pudo conectar con el backend.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card login-card-wide">
                <div className="login-logo">
                    <img 
  src="/logo.jpeg" 
  alt="Quanty Management" 
  style={{ 
    width: "160px", 
    height: "auto", 
    objectFit: "contain",
    borderRadius: "90%"
  }}
/>
                    <div>
                        <h1>{nombreEmpresa}</h1>
                        <p>Sistema de facturación y gestión local</p>
                    </div>
                </div>

                <div className="login-badge"><span className="status-dot"></span>Acceso conectado a usuarios, sucursales y ambiente DTE</div>
                <h2 className="login-title">Bienvenido</h2>
                <p className="login-subtitle">Ingresa con un usuario real de la base. La sucursal se carga según las registradas y el ambiente DTE queda listo para pruebas o productivo.</p>

                {error && <div className="alert error">{error}</div>}

                <form className="page-stack" onSubmit={handleLogin}>
                    <div className="form-grid two">
                        <div className="app-field">
                            <label>Usuario</label>
                            <input name="usuario" value={form.usuario} onChange={handleChange} placeholder="Tu usuario" autoComplete="username" />
                        </div>

                        <div className="app-field">
                            <label>Contraseña</label>
                            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" autoComplete="current-password" />
                        </div>
                    </div>

                    <div className="form-grid two">
                        <div className="app-field">
                            <label>Sucursal</label>
                            <select name="sucursal_id" value={form.sucursal_id} onChange={handleChange} disabled={loadingContexto}>
                                {contexto.sucursales.length === 0 ? (
                                    <option value="">Sin sucursales registradas</option>
                                ) : (
                                    contexto.sucursales.map((sucursal) => (
                                        <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className="app-field">
                            <label>Ambiente DTE</label>
                            <select name="ambiente" value={form.ambiente} onChange={handleChange}>
                                {contexto.ambientes.map((ambiente) => (
                                    <option key={ambiente.codigo} value={ambiente.codigo}>{ambiente.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary login-submit" disabled={loading || loadingContexto}>
                        {loading ? "Entrando..." : "Iniciar sesión"}
                    </button>
                </form>

                <div className="login-footer">
                    {contexto.sucursales.length > 0
                        ? `${contexto.sucursales.length} sucursal(es) activas detectadas`
                        : "Agrega una sucursal activa en la base para operar con contexto completo"}
                </div>
            </div>
        </div>
    );
}

export default Login;
