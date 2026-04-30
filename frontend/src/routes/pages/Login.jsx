import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginUsuario } from "../services/authService";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [form, setForm] = useState({
        usuario: "usuario",
        password: "usuario123",
        sucursal: "Casa Matriz — San Salvador",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await loginUsuario({ username: form.usuario, password: form.password });
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
            <div className="login-card">
                <div className="login-logo">
                    <div className="login-mark">QM</div>
                    <div>
                        <h1>Quanty Management</h1>
                        <p>Sistema de facturación y gestión local</p>
                    </div>
                </div>

                <div className="login-badge"><span className="status-dot"></span>Login conectado a core.usuario</div>
                <h2 className="login-title">Bienvenido</h2>
                <p className="login-subtitle">Ahora el acceso consulta tu tabla de usuarios. Mantuvimos listo el usuario base que pediste para que no te compliques.</p>

                {error && <div className="alert error">{error}</div>}
                <div className="alert info">Credenciales base: <strong>usuario</strong> / <strong>usuario123</strong></div>

                <form className="page-stack" onSubmit={handleLogin}>
                    <div className="app-field">
                        <label>Usuario</label>
                        <input name="usuario" value={form.usuario} onChange={handleChange} placeholder="Ej: usuario" />
                    </div>

                    <div className="app-field">
                        <label>Contraseña</label>
                        <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
                    </div>

                    <div className="app-field">
                        <label>Sucursal</label>
                        <select name="sucursal" value={form.sucursal} onChange={handleChange}>
                            <option>Casa Matriz — San Salvador</option>
                            <option>Sucursal Santa Ana</option>
                            <option>Sucursal San Miguel</option>
                        </select>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Entrando..." : "Iniciar sesión"}
                    </button>
                </form>

                <div className="login-footer">Rol base actual: administrador · Usuario almacenado en base de datos</div>
            </div>
        </div>
    );
}

export default Login;
