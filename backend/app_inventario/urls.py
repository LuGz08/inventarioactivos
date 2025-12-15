"""
ESTRUCTURA DE URLs DEL SISTEMA DE INVENTARIO

Este archivo define todas las rutas URL de la aplicación:
- API REST para el frontend moderno (ViewSets)
- Vistas tradicionales Django para el frontend clásico
- Endpoints AJAX para funcionalidades dinámicas
"""

"""
¿QUÉ ES UN ENDPOINT AJAX?
    - URLs que devuelven JSON (no HTML)
    - Se llaman desde JavaScript
    - Permiten actualizar partes de la página sin recargar
    
    Este endpoint en particular:
    - URL: /get-modelos-by-marca/?marca_id=1
    - Devuelve: [{"id": 1, "nombre": "Modelo A"}, ...]
    - Se usa para llenar dinámicamente el select de modelos
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import (
    ProveedoresViewSet,
    MarcasViewSet,
    CategoriasViewSet,
    ModelosViewSet,
    EstadosViewSet,
    ProductosViewSet,
    UsuariosViewSet,
    AsignacionesViewSet,
    MantencionesViewSet,
    HistorialEstadosViewSet,
    DocumentacionesViewSet,
    NotificacionesViewSet,
    LogAccesoViewSet,
    SucursalViewSet,
    CodigoQRViewSet,
    MovimientosViewSet,
    CPUViewSet,
    GPUViewSet,
    ComponentesViewSet,

)

# Crear el router
router = DefaultRouter()

# Registrar todos los ViewSets
router.register(r'proveedores', ProveedoresViewSet, basename='proveedores')
router.register(r'marcas', MarcasViewSet, basename='marcas')
router.register(r'categorias', CategoriasViewSet, basename='categorias')
router.register(r'modelos', ModelosViewSet, basename='modelos')
router.register(r'estados', EstadosViewSet, basename='estados')
router.register(r'productos', ProductosViewSet, basename='productos')
router.register(r'usuarios', UsuariosViewSet, basename='usuarios')
router.register(r'asignaciones', AsignacionesViewSet, basename='asignaciones')
router.register(r'mantenciones', MantencionesViewSet, basename='mantenciones')
router.register(r'historial-estados', HistorialEstadosViewSet, basename='historial-estados')
router.register(r'documentaciones', DocumentacionesViewSet, basename='documentaciones')
router.register(r'notificaciones', NotificacionesViewSet, basename='notificaciones')
router.register(r'logs-acceso', LogAccesoViewSet, basename='logs-acceso')
router.register(r'sucursales', SucursalViewSet)
router.register(r'codigos-qr', CodigoQRViewSet)
router.register(r'movimientos', MovimientosViewSet, basename='movimientos')
router.register(r'cpu', CPUViewSet)
router.register(r'gpu', GPUViewSet)
router.register(r'componentes', ComponentesViewSet)

# URLs de la app
urlpatterns = [
    path('api/', include(router.urls)),

    #   INDEX
    path('', views.dashboard, name='dashboard'),
    path('dashboard/', views.dashboard, name='dashboard'),

    # PRODUCTOS
    path('productos/', views.productos_list, name='productos'),
    path('productos/agregar/', views.productos_create, name='producto_create'),
    path('productos/<int:pk>/', views.producto_detail, name='producto_detail'),
    path('productos/<int:pk>/editar/', views.productos_edit, name='producto_edit'),
    path('productos/<int:pk>/eliminar/', views.productos_delete, name='producto_delete'),
    path('productos/disponibles/', views.productos_disponibles, name='productos_disponibles'),


    # 🏷️ CATEGORIAS
    path('categorias/', views.categorias_list, name='categorias'),
    path('categorias/agregar/', views.categorias_create, name='categoria_create'),
    path('categorias/<int:pk>/editar/', views.categorias_edit, name='categoria_edit'),
    path('categorias/<int:pk>/eliminar/', views.categorias_delete, name='categoria_delete'),


    # 🏷️ PROVEEDORES
    path('proveedores/', views.proveedores_list, name='proveedores'),
    path('proveedores/agregar/', views.proveedores_create, name='proveedor_create'),
    path('proveedores/<int:pk>/editar/', views.proveedores_edit, name='proveedor_edit'),
    path('proveedores/<int:pk>/eliminar/', views.proveedores_delete, name='proveedor_delete'),

    #   REPORTES
    path('reportes/', views.reportes, name='reportes'),

    #   NOTIFICACIONES
    path('notificaciones/', views.notificaciones, name='notificaciones'),
    path('notificaciones/<int:pk>/marcar-leida/', views.marcar_leida, name='marcar_leida'),
    path('notificaciones/marcar-todas-leidas/', views.marcar_todas_leidas, name='marcar_todas_leidas'),
    path('notificaciones/no-leidas/', views.no_leidas, name='no_leidas'),


    #   CONFIGURACION
    path('configuracion/', views.configuracion, name='configuracion'),


    # ============= ENDPOINTS AJAX =============
    path('get-modelos-by-marca/', views.get_modelos_by_marca, name='get_modelos_by_marca'),
]