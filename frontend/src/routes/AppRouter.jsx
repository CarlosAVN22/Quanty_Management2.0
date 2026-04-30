import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Clientes from "../pages/Clientes";
import Productos from "../pages/Productos";
import Facturacion from "../pages/Facturacion";
import Ventas from "../pages/Ventas";
import Inventario from "../pages/Inventario";
import DocumentosDTE from "../pages/DocumentosDTE";
import Pagos from "../pages/Pagos";
import Empresa from "../pages/Empresa";
import Usuarios from "../pages/Usuarios";
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/ProtectedRoute";

const wrapped = (permission, element) => (
    <ProtectedRoute permission={permission}>
        <MainLayout>{element}</MainLayout>
    </ProtectedRoute>
);

function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/dashboard" element={wrapped("dashboard", <Dashboard />)} />
                <Route path="/facturacion" element={wrapped("facturacion", <Facturacion />)} />
                <Route path="/ventas" element={wrapped("ventas", <Ventas />)} />
                <Route path="/clientes" element={wrapped("clientes", <Clientes />)} />
                <Route path="/productos" element={wrapped("productos", <Productos />)} />
                <Route path="/inventario" element={wrapped("inventario", <Inventario />)} />
                <Route path="/documentos-dte" element={wrapped("documentosDte", <DocumentosDTE />)} />
                <Route path="/pagos" element={wrapped("pagos", <Pagos />)} />
                <Route path="/empresa" element={wrapped("empresa", <Empresa />)} />
                <Route path="/usuarios" element={wrapped("usuarios", <Usuarios />)} />
            </Routes>
        </BrowserRouter>
    );
}

export default AppRouter;
