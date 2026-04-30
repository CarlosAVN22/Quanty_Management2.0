export const ROLE_PERMISSIONS = {
    ADMINISTRADOR: {
        dashboard: true,
        facturacion: true,
        ventas: true,
        clientes: true,
        clientesCrear: true,
        clientesEditar: true,
        clientesEliminar: true,
        productos: true,
        inventario: true,
        documentosDte: true,
        pagos: true,
        empresa: true,
        usuarios: true,
    },
    CAJERO: {
        dashboard: true,
        facturacion: true,
        ventas: true,
        clientes: true,
        clientesCrear: true,
        clientesEditar: false,
        clientesEliminar: false,
        productos: true,
        inventario: false,
        documentosDte: true,
        pagos: true,
        empresa: false,
        usuarios: false,
    },
    BODEGUERO: {
        dashboard: true,
        facturacion: false,
        ventas: false,
        clientes: true,
        clientesCrear: false,
        clientesEditar: false,
        clientesEliminar: false,
        productos: true,
        inventario: true,
        documentosDte: false,
        pagos: false,
        empresa: false,
        usuarios: false,
    },
};

export const getCurrentUser = () => {
    try {
        return JSON.parse(localStorage.getItem('qm_usuario') || 'null');
    } catch {
        return null;
    }
};

export const clearCurrentUser = () => localStorage.removeItem('qm_usuario');

export const canAccess = (key, user = getCurrentUser()) => {
    if (!user?.rol) return false;
    return Boolean(ROLE_PERMISSIONS[user.rol]?.[key]);
};

export const authHeaders = () => {
    const user = getCurrentUser();
    if (!user) return {};
    return {
        'x-user-id': user.id ? String(user.id) : '',
        'x-user-role': user.rol || '',
        'x-user-name': user.username || user.nombre || '',
        'x-sucursal-id': user.sucursal_id ? String(user.sucursal_id) : '',
        'x-sucursal-name': user.sucursal_nombre || '',
        'x-dte-ambiente': user.ambiente || 'TEST',
    };
};
