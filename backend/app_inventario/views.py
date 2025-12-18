from datetime import date
import pandas as pd # Necesario para leer Excel
from django.db import transaction # Para atomicidad en base de datos

from rest_framework.filters import OrderingFilter, SearchFilter
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.db import models 
from .services import NotificacionService
from django.contrib.auth.decorators import login_required

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser # Parsers para subida de archivos

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Proveedores, Marcas, Categorias, Modelos, Estados, Productos,
    Usuarios, Asignaciones, Mantenciones, HistorialEstados,
    Documentaciones, Notificaciones, LogAcceso, Sucursales, 
    CodigoQR, Usuarios, Movimientos,
    CPU, GPU, Componentes, Facturas
)
from .serializers import (
    ProveedoresSerializer, MarcasSerializer, CategoriasSerializer,
    ModelosSerializer, EstadosSerializer, SucursalSerializer, CodigoQRSerializer,
    ProductosListSerializer, ProductosDetailSerializer, ProductosCreateUpdateSerializer,
    UsuariosSerializer, UsuariosCreateSerializer,
    AsignacionesSerializer, AsignacionesCreateSerializer,
    MantencionesSerializer,
    HistorialEstadosSerializer, HistorialEstadosCreateSerializer,
    DocumentacionesSerializer, NotificacionesSerializer, LogAccesoSerializer, UsuariosUpdateSerializer, MovimientosSerializer,
    CPUSerializer, GPUSerializer,
    ComponentesSerializer,  FacturaSerializer
)
from .forms import (
    ProductoForm, ProductoFilterForm,
    ProveedorForm, ProveedorFilterForm,
    CategoriasForm, CategoriasFilterForm,
    EstadosForm, EstadosFilterForm,
    MarcasForm, MarcasFilterForm,
    ModelosForm, ModelosFilterForm,
    CPUForm, CPUFilterForm,
    GPUForm, GPUFilterForm,
)
from django.contrib.auth.models import User # Asegurar importación de User

# ================== JWT PERSONALIZADO ==================


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer personalizado para obtener tokens JWT.
    Además de los tokens, devuelve información básica del usuario.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Información extra en el payload del token (opcional)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        # Si tienes un campo extra de rol/perfil podrías agregarlo aquí

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Además de access/refresh, devolvemos info del usuario
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "is_staff": self.user.is_staff,
        }

        return data


class MyTokenObtainPairView(TokenObtainPairView):
    """
    Vista para obtener el par de tokens (access + refresh) usando el
    serializer personalizado de arriba.
    """
    serializer_class = MyTokenObtainPairSerializer


# ============= VIEWSETS TABLAS BÁSICAS =============


class ProveedoresViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Proveedores"""
    queryset = Proveedores.objects.all()
    serializer_class = ProveedoresSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "rut", "contacto"]
    ordering_fields = ["nombre", "rut"]
    ordering = ["nombre"]


class MarcasViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Marcas"""
    queryset = Marcas.objects.all()
    serializer_class = MarcasSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre"]
    ordering = ["nombre"]


class CategoriasViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Categorías"""
    queryset = Categorias.objects.all()
    serializer_class = CategoriasSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "descripcion"]
    ordering = ["nombre"]


class ModelosViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Modelos"""
    queryset = Modelos.objects.select_related("marca").all()
    serializer_class = ModelosSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["marca"]
    search_fields = ["nombre", "marca__nombre"]
    ordering_fields = ["nombre", "marca__nombre"]
    ordering = ["marca__nombre", "nombre"]


class EstadosViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Estados"""
    queryset = Estados.objects.all()
    serializer_class = EstadosSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "descripcion"]
    ordering = ["nombre"]


class SucursalViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Sucursales"""
    queryset = Sucursales.objects.all()
    serializer_class = SucursalSerializer
    permission_classes = [IsAuthenticated]


class CodigoQRViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar códigos QR asociados a productos"""
    queryset = CodigoQR.objects.all()
    serializer_class = CodigoQRSerializer
    permission_classes = [IsAuthenticated]

# ============= VIEWSET DE PRODUCTOS =============


class ProductosViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Productos"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["categoria", "estado", "proveedor", "modelo"]
    search_fields = ["nro_serie", "modelo__nombre", "categoria__nombre"]
    ordering_fields = ["fecha_compra", "nro_serie"]
    ordering = ["-fecha_compra"]

    def get_queryset(self):
        """
        OPTIMIZACIÓN CON SELECT_RELATED:
        En lugar de hacer una consulta por cada relación (proveedor, modelo, etc.),
        select_related hace un JOIN en SQL y trae todos los datos en una sola consulta.
        """
        return (
            Productos.objects.select_related(
                "proveedor", "modelo", "modelo__marca", "categoria", "estado", "sucursal",
            )
            .all()
        )

    def get_serializer_class(self):
        """Usa serializer diferente según la acción"""
        if self.action == "retrieve":
            return ProductosDetailSerializer
        elif self.action in ["create", "update", "partial_update"]:
            return ProductosCreateUpdateSerializer
        return ProductosListSerializer

    # ======================================================
    # IMPORTACIÓN MASIVA DE PRODUCTOS (Excel)
    # ======================================================
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def importar_excel(self, request):
        """
        Carga masiva de productos desde Excel.
        Columnas esperadas: 
        nro_serie, fecha_compra, valor, marca, modelo, categoria, estado, sucursal, proveedor, garantia_meses
        """
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'No se envió ningún archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(archivo)
            creados = 0
            errores = []

            # Se usa transacción atómica para asegurar integridad, 
            # aunque capturamos errores por fila para permitir cargas parciales si se desea.
            with transaction.atomic():
                for index, row in df.iterrows():
                    try:
                        # 1. Validar Nro Serie único
                        serie = str(row['nro_serie']).strip()
                        if Productos.objects.filter(nro_serie=serie).exists():
                            errores.append(f"Fila {index+2}: Serie {serie} ya existe.")
                            continue

                        # 2. Resolver Relaciones (Foreign Keys)
                        # Busca por nombre, si no existe lo crea (get_or_create)
                        
                        # Marca y Modelo
                        marca_nombre = str(row.get('marca', 'Generica')).strip()
                        modelo_nombre = str(row.get('modelo', 'Generico')).strip()
                        
                        marca_obj, _ = Marcas.objects.get_or_create(nombre=marca_nombre)
                        modelo_obj, _ = Modelos.objects.get_or_create(marca=marca_obj, nombre=modelo_nombre)

                        # Categoria
                        cat_nombre = str(row.get('categoria', 'General')).strip()
                        cat_obj, _ = Categorias.objects.get_or_create(nombre=cat_nombre)

                        # Estado
                        est_nombre = str(row.get('estado', 'Operativo')).strip()
                        # Intentamos buscar exacto, si no, creamos o asignamos uno por defecto
                        estado_obj, _ = Estados.objects.get_or_create(nombre=est_nombre)

                        # Sucursal
                        suc_nombre = str(row.get('sucursal', 'Matriz')).strip()
                        suc_obj, _ = Sucursales.objects.get_or_create(nombre=suc_nombre)

                        # Proveedor
                        prov_nombre = str(row.get('proveedor', '')).strip()
                        if prov_nombre:
                            # Buscamos proveedor que contenga el nombre
                            prov_obj = Proveedores.objects.filter(nombre__icontains=prov_nombre).first()
                            if not prov_obj:
                                # Opcional: Crear proveedor genérico si no existe
                                prov_obj, _ = Proveedores.objects.get_or_create(
                                    nombre=prov_nombre, 
                                    defaults={'rut': '99999999-9', 'contacto': 'S/I', 'telefono': '000', 'correo': 'sin@correo.com'}
                                )
                        else:
                            # Proveedor por defecto si viene vacío
                            prov_obj, _ = Proveedores.objects.get_or_create(nombre="Proveedor Desconocido", defaults={'rut': '00000000-0', 'correo': 'na@na.com'})

                        # Fecha
                        fecha = row.get('fecha_compra')
                        if pd.isna(fecha):
                            fecha = date.today()

                        # Valor
                        valor = row.get('valor', 0)
                        if pd.isna(valor): valor = 0

                        # Garantía
                        garantia = row.get('garantia_meses', 12)
                        if pd.isna(garantia): garantia = 12

                        # 3. Crear Producto
                        Productos.objects.create(
                            nro_serie=serie,
                            fecha_compra=fecha,
                            valor_compra=valor,
                            modelo=modelo_obj,
                            categoria=cat_obj,
                            estado=estado_obj,
                            sucursal=suc_obj,
                            proveedor=prov_obj,
                            garantia_meses=int(garantia)
                        )
                        creados += 1

                    except Exception as ex:
                        errores.append(f"Fila {index+2}: Error - {str(ex)}")

            return Response({
                'mensaje': f'Importación finalizada. Productos creados: {creados}.',
                'errores': errores
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Error procesando el archivo: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def disponibles(self, request):
        """Retorna productos disponibles (sin asignación activa)"""
        productos_asignados = Asignaciones.objects.filter(
            fecha_devolucion__isnull=True
        ).values_list("producto_id", flat=True)

        productos = self.get_queryset().exclude(id__in=productos_asignados)
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def por_categoria(self, request):
        """Agrupa productos por categoría"""
        from django.db.models import Count

        stats = Categorias.objects.annotate(
            total_productos=Count("productos")
        ).values("nombre", "total_productos")
        return Response(stats)

    @action(detail=True, methods=["post"])
    def asignar(self, request, pk=None):
        """Asigna un producto a un usuario"""
        producto = self.get_object()
        usuario_id = request.data.get("usuario_id")

        # Verificar que no tenga asignación activa
        if Asignaciones.objects.filter(
            producto=producto, fecha_devolucion__isnull=True
        ).exists():
            return Response(
                {"error": "Este producto ya tiene una asignación activa"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Crear asignación
        asignacion = Asignaciones.objects.create(
            producto=producto,
            usuario_id=usuario_id,
        )

        return Response(
            AsignacionesSerializer(asignacion).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def devolver(self, request, pk=None):
        """Marca como devuelto un producto asignado"""
        producto = self.get_object()

        try:
            asignacion = Asignaciones.objects.get(
                producto=producto,
                fecha_devolucion__isnull=True,
            )
            asignacion.fecha_devolucion = date.today()
            asignacion.save()

            return Response(
                {"mensaje": "Producto devuelto exitosamente"},
                status=status.HTTP_200_OK,
            )
        except Asignaciones.DoesNotExist:
            return Response(
                {"error": "Este producto no tiene una asignación activa"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def create(self, request, *args, **kwargs):
        componentes_data = request.data.pop("componentes", None)

        # Crear producto normalmente
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producto = serializer.save()

        # Crear componentes si vienen en el JSON
        if componentes_data:
            componentes_data["producto_id"] = producto.id
            comp_serializer = ComponentesSerializer(data=componentes_data)
            comp_serializer.is_valid(raise_exception=True)
            comp_serializer.save()

        return Response(
            ProductosDetailSerializer(producto).data,
            status=status.HTTP_201_CREATED
        )

    


# ============= VIEWSET DE USUARIOS =============

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Usuarios
from .serializers import (
    UsuariosSerializer,
    UsuariosCreateSerializer,
    UsuariosUpdateSerializer,
)


class UsuariosViewSet(viewsets.ModelViewSet):
    """
    CRUD de usuarios + endpoints de perfil y cambio de contraseña.
    Incluye importación masiva.
    """

    queryset = Usuarios.objects.select_related("user").all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = [
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
    ]
    ordering_fields = ["user__username", "user__first_name"]
    ordering = ["user__username"]

    def get_serializer_class(self):
        """
        Usa distintos serializers según la acción:
        - create: crea User + Usuarios
        - update/partial_update: actualiza datos + password
        - list/retrieve/me: lectura
        """
        if self.action == "create":
            return UsuariosCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UsuariosUpdateSerializer
        return UsuariosSerializer

    # ======================================================
    # IMPORTACIÓN MASIVA DE USUARIOS (Excel)
    # ======================================================
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def importar_excel(self, request):
        """
        Carga masiva de usuarios desde Excel.
        Columnas esperadas: username, email, password, nombre, apellido, rol, es_staff
        """
        archivo = request.FILES.get('archivo')
        if not archivo:
            return Response({'error': 'No se envió ningún archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(archivo)
            
            # Columnas mínimas requeridas
            if 'username' not in df.columns or 'password' not in df.columns:
                return Response({'error': 'El archivo debe tener al menos las columnas "username" y "password".'}, status=status.HTTP_400_BAD_REQUEST)

            creados = 0
            errores = []

            with transaction.atomic():
                for index, row in df.iterrows():
                    try:
                        username = str(row['username']).strip()
                        if User.objects.filter(username=username).exists():
                            errores.append(f"Fila {index+2}: Usuario '{username}' ya existe.")
                            continue

                        # Datos opcionales
                        email = row.get('email', '')
                        if pd.isna(email): email = ''
                        
                        password = str(row['password'])
                        
                        nombre = row.get('nombre', '')
                        if pd.isna(nombre): nombre = ''
                        
                        apellido = row.get('apellido', '')
                        if pd.isna(apellido): apellido = ''

                        es_staff = str(row.get('es_staff', 'no')).lower() in ['si', 'yes', 'true', '1']

                        # 1. Crear User Django
                        user = User.objects.create_user(
                            username=username,
                            email=email,
                            password=password,
                            first_name=nombre,
                            last_name=apellido
                        )
                        user.is_staff = es_staff
                        user.save()

                        # 2. Crear Perfil Usuario (modelo Usuarios)
                        rol_input = str(row.get('rol', 'USUARIO')).upper()
                        rol = 'ADMIN' if rol_input in ['ADMIN', 'ADMINISTRADOR'] else 'USUARIO'

                        Usuarios.objects.create(user=user, rol=rol)
                        creados += 1

                    except Exception as e:
                        errores.append(f"Fila {index+2}: {str(e)}")

            return Response({
                'mensaje': f'Proceso finalizado. Usuarios creados: {creados}.',
                'errores': errores
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'Error procesando archivo: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

    # ---------- PERFIL: /api/usuarios/me/ ----------
    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        """
        GET   /api/usuarios/me/     -> datos del usuario actual
        PATCH /api/usuarios/me/     -> actualizar nombre/email del usuario actual
        """
        try:
            usuario = Usuarios.objects.get(user=request.user)
        except Usuarios.DoesNotExist:
            return Response(
                {"detail": "Usuario no encontrado"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Leer datos
        if request.method.lower() == "get":
            serializer = UsuariosSerializer(usuario)
            return Response(serializer.data)

        # Actualizar datos (perfil)
        serializer = UsuariosUpdateSerializer(
            usuario, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # ---------- CAMBIO DE CONTRASEÑA: /api/usuarios/cambiar_password/ ----------
    @action(detail=False, methods=["post"], url_path="cambiar_password")
    def cambiar_password(self, request):
        """
        POST /api/usuarios/cambiar_password/

        Body JSON:
        {
          "old_password": "actual",
          "new_password": "NuevaClave123!"
        }
        """
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not old_password or not new_password:
            return Response(
                {"detail": "old_password y new_password son obligatorios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(old_password):
          return Response(
              {"detail": "La contraseña actual no es correcta."},
              status=status.HTTP_400_BAD_REQUEST,
          )

        if len(new_password) < 8:
            return Response(
                {"detail": "La nueva contraseña debe tener al menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        return Response({"detail": "Contraseña actualizada correctamente."})


# ============= VIEWSET DE ASIGNACIONES =============


class AsignacionesViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Asignaciones"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["usuario", "producto"]
    ordering_fields = ["fecha_asignacion", "fecha_devolucion"]
    ordering = ["-fecha_asignacion"]

    def get_queryset(self):
        """Optimiza las queries"""
        return Asignaciones.objects.select_related(
            "producto", "producto__categoria", "usuario", "usuario__user"
        ).all()

    def get_serializer_class(self):
        """Usa serializer diferente para crear"""
        if self.action == "create":
            return AsignacionesCreateSerializer
        return AsignacionesSerializer

    @action(detail=False, methods=["get"])
    def activas(self, request):
        """Retorna solo asignaciones activas"""
        asignaciones = self.get_queryset().filter(fecha_devolucion__isnull=True)
        serializer = self.get_serializer(asignaciones, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def devueltas(self, request):
        """Retorna solo asignaciones devueltas"""
        asignaciones = self.get_queryset().filter(fecha_devolucion__isnull=False)
        serializer = self.get_serializer(asignaciones, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def marcar_devuelta(self, request, pk=None):
        """Marca una asignación como devuelta"""
        asignacion = self.get_object()

        if asignacion.fecha_devolucion:
            return Response(
                {"error": "Esta asignación ya fue marcada como devuelta"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        asignacion.fecha_devolucion = date.today()
        asignacion.save()

        return Response(
            self.get_serializer(asignacion).data,
            status=status.HTTP_200_OK,
        )


# ============= VIEWSET DE MANTENCIONES =============


class MantencionesViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Mantenciones"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["producto", "proveedor"]
    ordering_fields = ["fecha"]
    ordering = ["-fecha"]
    serializer_class = MantencionesSerializer

    def get_queryset(self):
        return Mantenciones.objects.select_related("producto", "proveedor").all()

    @action(detail=False, methods=["get"])
    def proximas(self, request):
        """Retorna mantenciones programadas (futuras)"""
        mantenciones = self.get_queryset().filter(fecha__gte=date.today())
        serializer = self.get_serializer(mantenciones, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def realizadas(self, request):
        """Retorna mantenciones ya realizadas"""
        mantenciones = self.get_queryset().filter(fecha__lt=date.today())
        serializer = self.get_serializer(mantenciones, many=True)
        return Response(serializer.data)


# ============= VIEWSET DE HISTORIAL DE ESTADOS =============


class HistorialEstadosViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Historial de Estados"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["producto", "estado"]
    ordering_fields = ["fecha"]
    ordering = ["-fecha"]

    def get_queryset(self):
        return HistorialEstados.objects.select_related("producto", "estado").all()

    def get_serializer_class(self):
        """Usa serializer especial para crear (actualiza producto automáticamente)"""
        if self.action == "create":
            return HistorialEstadosCreateSerializer
        return HistorialEstadosSerializer


# ============= VIEWSET DE DOCUMENTACIÓN =============


class DocumentacionesViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar Documentación"""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["producto", "tipo_documento"]
    search_fields = ["nombre_archivo", "tipo_documento"]
    ordering_fields = ["fecha_subida"]
    ordering = ["-fecha_subida"]
    serializer_class = DocumentacionesSerializer

    def get_queryset(self):
        return Documentaciones.objects.select_related("producto").all()


# ============= VIEWSET DE NOTIFICACIONES =============


class NotificacionesViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionesSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filtra notificaciones del usuario o globales
        return Notificaciones.objects.filter(
            models.Q(usuario=self.request.user) | models.Q(usuario__isnull=True)
        )
    
    @action(detail=False, methods=['get'])
    def no_leidas(self, request):
        """Obtiene solo las notificaciones no leídas"""
        notificaciones = self.get_queryset().filter(leido=False)
        serializer = self.get_serializer(notificaciones, many=True)
        return Response({
            'count': notificaciones.count(),
            'notificaciones': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def marcar_leida(self, request, pk=None):
        """Marca una notificación como leída"""
        notificacion = self.get_object()
        notificacion.marcar_como_leida()
        return Response({'status': 'notificación marcada como leída'})
    
    @action(detail=False, methods=['post'])
    def marcar_todas_leidas(self, request):
        """Marca todas las notificaciones como leídas"""
        from django.utils import timezone
        notificaciones = self.get_queryset().filter(leido=False)
        notificaciones.update(leido=True, fecha_lectura=timezone.now())
        return Response({
            'status': 'todas las notificaciones marcadas como leídas',
            'count': notificaciones.count()
        })
    
    @action(detail=False, methods=['delete'])
    def limpiar_leidas(self, request):
        """Elimina las notificaciones leídas"""
        count = self.get_queryset().filter(leido=True).delete()[0]
        return Response({
            'status': 'notificaciones leídas eliminadas',
            'count': count
        })

# ============= VIEWSET DE LOG DE ACCESOS =============


class LogAccesoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar Logs de Acceso (solo lectura)"""
    queryset = LogAcceso.objects.select_related("usuario", "usuario__user").all()
    serializer_class = LogAccesoSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["usuario"]
    ordering_fields = ["fecha_hora"]
    ordering = ["-fecha_hora"]

    @action(detail=False, methods=["get"])
    def ultimos_accesos(self, request):
        """Retorna los últimos 50 accesos"""
        logs = self.get_queryset()[:50]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)

# ============= VIEWSETS DE CPU Y GPU =============
class CPUViewSet(viewsets.ModelViewSet):
    queryset = CPU.objects.all()
    serializer_class = CPUSerializer


class GPUViewSet(viewsets.ModelViewSet):
    queryset = GPU.objects.all()
    serializer_class = GPUSerializer

# ============= VIEWSET DE COMPONENTES =============
class ComponentesViewSet(viewsets.ModelViewSet):
    queryset = Componentes.objects.all()
    serializer_class = ComponentesSerializer


class FacturasViewSet(viewsets.ModelViewSet):
    queryset = Facturas.objects.select_related('proveedor').prefetch_related('productos').all()
    serializer_class = FacturaSerializer
    permission_classes = [IsAuthenticated]

    parser_classes = (MultiPartParser, FormParser)

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['proveedor', 'fecha_emision']
    search_fields = ['numero_factura', 'observaciones']
    ordering_fields = ['fecha_emision', 'monto_total']
    ordering = ['-fecha_emision']

    @action(detail=True, methods=['get'])
    def productos(self, request, pk=None):
        """Lista productos asociados a esta factura"""
        factura = self.get_object()
        productos = factura.productos.all()
        from .serializers import ProductosListSerializer
        serializer = ProductosListSerializer(productos, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def agregar_producto(self, request, pk=None):
        """Asocia un producto existente a esta factura"""
        factura = self.get_object()
        producto_id = request.data.get('producto_id')
        
        if not producto_id:
            return Response(
                {'error': 'Se requiere producto_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Productos
            producto = Productos.objects.get(id=producto_id)
            factura.productos.add(producto)
            return Response({'mensaje': f'Producto {producto.nro_serie} asociado correctamente'})
        except Productos.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def quitar_producto(self, request, pk=None):
        """Desasocia un producto de esta factura"""
        factura = self.get_object()
        producto_id = request.data.get('producto_id')
        
        if not producto_id:
            return Response(
                {'error': 'Se requiere producto_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from .models import Productos
            producto = Productos.objects.get(id=producto_id)
            factura.productos.remove(producto)
            return Response({'mensaje': f'Producto {producto.nro_serie} desasociado correctamente'})
        except Productos.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )


class MovimientosViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar movimientos de stock.
    """
    queryset = Movimientos.objects.all()
    serializer_class = MovimientosSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["tipo", "sku"]
    search_fields = ["sku", "proveedor", "referencia", "comentarios"]
    ordering_fields = ["fecha", "cantidad"]
    ordering = ["-fecha"]


# ============= VISTAS BASADAS EN TEMPLATES (HTML) =============
# Estas vistas siguen usando la autenticación clásica de Django (session),
# pero no interfieren con JWT. Puedes mantenerlas o migrarlas a frontend SPA.


def proveedores_list(request):
    """Lista de proveedores con filtros"""
    proveedores = Proveedores.objects.all()
    filter_form = ProveedorFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            proveedores = proveedores.filter(
                Q(nombre__icontains=search)
                | Q(rut__icontains=search)
                | Q(contacto__icontains=search)
            )

    proveedores = proveedores.order_by("nombre")

    context = {
        "proveedores": proveedores,
        "filter_form": filter_form,
        "total_proveedores": proveedores.count(),
    }

    return render(request, "listar_proveedores.html", context)


def proveedores_create(request):
    """Crear nuevo proveedor"""
    if request.method == "POST":
        form = ProveedorForm(request.POST)

        if form.is_valid():
            proveedor = form.save()
            messages.success(
                request, f"Proveedor {proveedor.nombre} creado exitosamente."
            )
            return redirect("proveedores")
        else:
            messages.error(
                request, "Error al crear el proveedor. Verifica los datos."
            )
    else:
        form = ProveedorForm()

    context = {
        "form": form,
        "title": "Agregar Proveedor",
        "action": "Crear",
    }
    return render(request, "agregar_proveedores.html", context)


def proveedores_edit(request, pk):
    """Editar proveedor existente"""
    proveedor = get_object_or_404(Proveedores, pk=pk)

    if request.method == "POST":
        form = ProveedorForm(request.POST, instance=proveedor)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"Proveedor {proveedor.nombre} actualizado exitosamente."
            )
            return redirect("proveedores")
        else:
            messages.error(request, "Error al actualizar el proveedor.")
    else:
        form = ProveedorForm(instance=proveedor)

    context = {
        "form": form,
        "proveedor": proveedor,
        "title": f"Editar Proveedor {proveedor.nombre}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_proveedores.html", context)


def proveedores_delete(request, pk):
    """Eliminar proveedor"""
    proveedor = get_object_or_404(Proveedores, pk=pk)

    if request.method == "POST":
        nombre = proveedor.nombre
        proveedor.delete()
        messages.success(
            request, f"Proveedor {nombre} eliminado exitosamente."
        )
        return redirect("proveedores")

    context = {
        "proveedor": proveedor,
    }
    return render(request, "eliminar_proveedores.html", context)


def categorias_list(request):
    """Lista de categorías con filtros"""
    categorias = Categorias.objects.all()
    filter_form = CategoriasFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            categorias = categorias.filter(
                Q(nombre__icontains=search)
                | Q(descripcion__icontains=search)
            )

    categorias = categorias.order_by("nombre")

    context = {
        "categorias": categorias,
        "filter_form": filter_form,
        "total_categorias": categorias.count(),
    }
    return render(request, "listar_categorias.html", context)


def categorias_create(request):
    """Crear nueva categoría"""
    if request.method == "POST":
        form = CategoriasForm(request.POST)

        if form.is_valid():
            categoria = form.save()
            messages.success(
                request, f"Categoría {categoria.nombre} creada exitosamente."
            )
            return redirect("categorias")
        else:
            messages.error(
                request, "Error al crear la categoría. Verifica los datos."
            )
    else:
        form = CategoriasForm()

    context = {
        "form": form,
        "title": "Agregar Categoría",
        "action": "Crear",
    }
    return render(request, "agregar_categorias.html", context)


def categorias_edit(request, pk):
    """Editar categoría existente"""
    categoria = get_object_or_404(Categorias, pk=pk)

    if request.method == "POST":
        form = CategoriasForm(request.POST, instance=categoria)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"Categoría {categoria.nombre} actualizada exitosamente."
            )
            return redirect("categorias")
        else:
            messages.error(request, "Error al actualizar la categoría.")
    else:
        form = CategoriasForm(instance=categoria)

    context = {
        "form": form,
        "categoria": categoria,
        "title": f"Editar Categoría {categoria.nombre}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_categorias.html", context)


def categorias_delete(request, pk):
    """Eliminar categoría"""
    categoria = get_object_or_404(Categorias, pk=pk)

    if request.method == "POST":
        nombre = categoria.nombre
        categoria.delete()
        messages.success(
            request, f"Categoría {nombre} eliminada exitosamente."
        )
        return redirect("categorias")

    context = {
        "categoria": categoria,
    }
    return render(request, "eliminar_categorias.html", context)


def marcas_list(request):
    """Lista de marcas con filtros"""
    marcas = Marcas.objects.all()
    filter_form = MarcasFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            marcas = marcas.filter(nombre__icontains=search)

    marcas = marcas.order_by("nombre")

    context = {
        "marcas": marcas,
        "filter_form": filter_form,
        "total_marcas": marcas.count(),
    }
    return render(request, "listar_marcas.html", context)


def marcas_create(request):
    """Crear nueva marca"""
    if request.method == "POST":
        form = MarcasForm(request.POST)

        if form.is_valid():
            marca = form.save()
            messages.success(
                request, f"Marca {marca.nombre} creada exitosamente."
            )
            return redirect("marcas")
        else:
            messages.error(
                request, "Error al crear la marca. Verifica los datos."
            )
    else:
        form = MarcasForm()

    context = {
        "form": form,
        "title": "Agregar Marca",
        "action": "Crear",
    }
    return render(request, "agregar_marca.html", context)


def marcas_edit(request, pk):
    """Editar marca existente"""
    marca = get_object_or_404(Marcas, pk=pk)

    if request.method == "POST":
        form = MarcasForm(request.POST, instance=marca)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"Marca {marca.nombre} actualizada exitosamente."
            )
            return redirect("marcas")
        else:
            messages.error(request, "Error al actualizar la marca.")
    else:
        form = MarcasForm(instance=marca)

    context = {
        "form": form,
        "marca": marca,
        "title": f"Editar Marca {marca.nombre}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_marca.html", context)


def marcas_delete(request, pk):
    """Eliminar marca"""
    marca = get_object_or_404(Marcas, pk=pk)

    if request.method == "POST":
        nombre = marca.nombre
        marca.delete()
        messages.success(
            request, f"Marca {nombre} eliminada exitosamente."
        )
        return redirect("marcas")

    context = {
        "marca": marca,
    }
    return render(request, "eliminar_marca.html", context)


def modelos_list(request):
    """Lista de modelos con filtros"""
    modelos = Modelos.objects.select_related("marca").all()
    filter_form = ModelosFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            modelos = modelos.filter(
                Q(nombre__icontains=search)
                | Q(marca__nombre__icontains=search)
            )

        marca = filter_form.cleaned_data.get("marca")
        if marca:
            modelos = modelos.filter(marca=marca)

    modelos = modelos.order_by("marca__nombre", "nombre")

    context = {
        "modelos": modelos,
        "filter_form": filter_form,
        "total_modelos": modelos.count(),
    }
    return render(request, "listar_modelos.html", context)


def modelos_create(request):
    """Crear nuevo modelo"""
    if request.method == "POST":
        form = ModelosForm(request.POST)

        if form.is_valid():
            modelo = form.save()
            messages.success(
                request, f"Modelo {modelo.nombre} creado exitosamente."
            )
            return redirect("modelos")
        else:
            messages.error(
                request, "Error al crear el modelo. Verifica los datos."
            )
    else:
        form = ModelosForm()

    context = {
        "form": form,
        "title": "Agregar Modelo",
        "action": "Crear",
    }
    return render(request, "agregar_modelo.html", context)


def modelos_edit(request, pk):
    """Editar modelo existente"""
    modelo = get_object_or_404(Modelos, pk=pk)

    if request.method == "POST":
        form = ModelosForm(request.POST, instance=modelo)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"Modelo {modelo.nombre} actualizado exitosamente."
            )
            return redirect("modelos")
        else:
            messages.error(request, "Error al actualizar el modelo.")
    else:
        form = ModelosForm(instance=modelo)

    context = {
        "form": form,
        "modelo": modelo,
        "title": f"Editar Modelo {modelo.nombre}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_modelo.html", context)


def modelos_delete(request, pk):
    """Eliminar modelo"""
    modelo = get_object_or_404(Modelos, pk=pk)

    if request.method == "POST":
        nombre = modelo.nombre
        modelo.delete()
        messages.success(
            request, f"Modelo {nombre} eliminado exitosamente."
        )
        return redirect("modelos")

    context = {
        "modelo": modelo,
    }
    return render(request, "eliminar_modelo.html", context)


def estados_list(request):
    """Lista de estados con filtros"""
    estados = Estados.objects.all()
    filter_form = EstadosFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            estados = estados.filter(
                Q(nombre__icontains=search)
                | Q(descripcion__icontains=search)
            )

    estados = estados.order_by("nombre")

    context = {
        "estados": estados,
        "filter_form": filter_form,
        "total_estados": estados.count(),
    }
    return render(request, "listar_estados.html", context)


def estados_create(request):
    """Crear nuevo estado"""
    if request.method == "POST":
        form = EstadosForm(request.POST)

        if form.is_valid():
            estado = form.save()
            messages.success(
                request, f"Estado {estado.nombre} creado exitosamente."
            )
            return redirect("estados")
        else:
            messages.error(
                request, "Error al crear el estado. Verifica los datos."
            )
    else:
        form = EstadosForm()

    context = {
        "form": form,
        "title": "Agregar Estado",
        "action": "Crear",
    }
    return render(request, "agregar_estado.html", context)


def estados_edit(request, pk):
    """Editar estado existente"""
    estado = get_object_or_404(Estados, pk=pk)

    if request.method == "POST":
        form = EstadosForm(request.POST, instance=estado)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"Estado {estado.nombre} actualizado exitosamente."
            )
            return redirect("estados")
        else:
            messages.error(request, "Error al actualizar el estado.")
    else:
        form = EstadosForm(instance=estado)

    context = {
        "form": form,
        "estado": estado,
        "title": f"Editar Estado {estado.nombre}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_estado.html", context)


def estados_delete(request, pk):
    """Eliminar estado"""
    estado = get_object_or_404(Estados, pk=pk)

    if request.method == "POST":
        nombre = estado.nombre
        estado.delete()
        messages.success(
            request, f"Estado {nombre} eliminado exitosamente."
        )
        return redirect("estados")

    context = {
        "estado": estado,
    }
    return render(request, "eliminar_estado.html", context)


#============ VISTAS DE NOTIFICACIONES =============

@login_required
def notificaciones(request):
    """Página de notificaciones"""
    # CORRECCIÓN: Usar fecha_creacion en lugar de fecha y hora
    notificaciones_list = Notificaciones.objects.filter(
        usuario=request.user
    ) | Notificaciones.objects.filter(usuario__isnull=True)
    
    notificaciones_list = notificaciones_list.order_by("-fecha_creacion")

    paginator = Paginator(notificaciones_list, 10)
    page_number = request.GET.get("page")
    notificaciones_page = paginator.get_page(page_number)

    total_notificaciones = notificaciones_list.count()
    # CORRECCIÓN: Usar 'leido' sin tilde
    notificaciones_no_leidas = notificaciones_list.filter(leido=False).count()
    notificaciones_leidas = total_notificaciones - notificaciones_no_leidas

    context = {
        "notificaciones": notificaciones_page,
        "total_notificaciones": total_notificaciones,
        "notificaciones_no_leidas": notificaciones_no_leidas,
        "notificaciones_leidas": notificaciones_leidas,
    }
    return render(request, "notificaciones.html", context)

@login_required
def marcar_leida(request, pk):
    """Marcar una notificación como leída"""
    notificacion = get_object_or_404(Notificaciones, pk=pk)
    # Usar el método del modelo
    notificacion.marcar_como_leida()
    
    messages.success(request, "Notificación marcada como leída.")
    return redirect("notificaciones")

@login_required
def marcar_todas_leidas(request):
    """Marcar todas las notificaciones como leídas"""
    if request.method == "POST":
        from django.utils import timezone
        # Filtrar por usuario
        queryset = Notificaciones.objects.filter(
            usuario=request.user, leido=False
        ) | Notificaciones.objects.filter(
            usuario__isnull=True, leido=False
        )
        queryset.update(leido=True, fecha_lectura=timezone.now())
        
        messages.success(
            request, "Todas las notificaciones han sido marcadas como leídas."
        )

    return redirect("notificaciones")

@login_required
def no_leidas(request):
    """Obtener conteo de notificaciones no leídas (para AJAX)"""
    queryset = Notificaciones.objects.filter(
        usuario=request.user, leido=False
    ) | Notificaciones.objects.filter(
        usuario__isnull=True, leido=False
    )
    
    count = queryset.count()
    
    # Si quieren el listado completo, incluirlo
    if request.GET.get('full') == 'true':
        from .serializers import NotificacionesSerializer
        serializer = NotificacionesSerializer(queryset, many=True)
        return JsonResponse({
            "count": count,
            "notificaciones": serializer.data
        })
    
    return JsonResponse({"count": count})

#-----------------------------------------------------------------------

def configuracion(request):
    """Página de configuración del sistema"""
    notificaciones_no_leidas = Notificaciones.objects.filter(leido=False).count()

    context = {
        "title": "Configuración del Sistema",
        "notificaciones_no_leidas": notificaciones_no_leidas,
    }
    return render(request, "configuracion.html", context)


def productos_list(request):
    """Lista de productos con filtros"""
    productos = Productos.objects.select_related(
        "categoria", "modelo", "modelo__marca", "estado", "proveedor"
    ).all()

    filter_form = ProductoFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            productos = productos.filter(
                Q(nro_serie__icontains=search)
                | Q(modelo__nombre__icontains=search)
                | Q(categoria__nombre__icontains=search)
            )

        categoria = filter_form.cleaned_data.get("categoria")
        if categoria:
            productos = productos.filter(categoria=categoria)

        estado = filter_form.cleaned_data.get("estado")
        if estado:
            productos = productos.filter(estado=estado)

        proveedor = filter_form.cleaned_data.get("proveedor")
        if proveedor:
            productos = productos.filter(proveedor=proveedor)

        solo_disponibles = filter_form.cleaned_data.get("solo_disponibles")
        if solo_disponibles:
            productos_asignados_ids = Asignaciones.objects.filter(
                fecha_devolucion__isnull=True
            ).values_list("producto_id", flat=True)
            productos = productos.exclude(id__in=productos_asignados_ids)

    productos = productos.order_by("-fecha_compra")

    context = {
        "productos": productos,
        "filter_form": filter_form,
        "total_productos": productos.count(),
    }
    return render(request, "listar_productos.html", context)


def productos_create(request):
    """Crear nuevo producto"""
    marcas = Marcas.objects.all()

    if request.method == "POST":
        form = ProductoForm(request.POST)

        if form.is_valid():
            producto = form.save()
            messages.success(
                request, f"Producto {producto.nro_serie} creado exitosamente."
            )
            return redirect("productos")
        else:
            messages.error(
                request, "Error al crear el producto. Verifica los datos."
            )
    else:
        form = ProductoForm()

    context = {
        "form": form,
        "marcas": marcas,
        "title": "Agregar Producto",
        "action": "Crear",
    }
    return render(request, "agregar_productos.html", context)


def productos_edit(request, pk):
    """Editar producto existente"""
    producto = get_object_or_404(Productos, pk=pk)

    if request.method == "POST":
        post_data = request.POST.copy()

        post_data["nro_serie"] = producto.nro_serie
        post_data["categoria"] = producto.categoria.id
        post_data["modelo"] = producto.modelo.id

        form = ProductoForm(post_data, instance=producto)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"Producto {producto.nro_serie} actualizado exitosamente."
            )
            return redirect("productos")
        else:
            print("Errores del formulario:", form.errors)
            messages.error(
                request, f"Error al actualizar el producto: {form.errors}"
            )
    else:
        form = ProductoForm(instance=producto)

    context = {
        "form": form,
        "producto": producto,
        "title": f"Editar Producto {producto.nro_serie}",
    }
    return render(request, "actualizar_productos.html", context)


def productos_delete(request, pk):
    """Eliminar producto"""
    producto = get_object_or_404(Productos, pk=pk)

    if request.method == "POST":
        nro_serie = producto.nro_serie
        producto.delete()
        messages.success(
            request, f"Producto {nro_serie} eliminado exitosamente."
        )
        return redirect("productos")

    context = {
        "producto": producto,
    }
    return render(request, "eliminar_productos.html", context)


def producto_detail(request, pk):
    """Ver detalle completo de un producto"""
    producto = get_object_or_404(
        Productos.objects.select_related(
            "categoria", "modelo", "modelo__marca", "estado", "proveedor"
        ).prefetch_related("asignaciones", "mantenciones", "historial_estados"),
        pk=pk,
    )

    context = {
        "producto": producto,
    }
    return render(request, "producto_detail.html", context)


def get_modelos_by_marca(request):
    """API endpoint para obtener modelos de una marca (AJAX)"""
    marca_id = request.GET.get("marca_id")

    if marca_id:
        modelos = Modelos.objects.filter(marca_id=marca_id).values("id", "nombre")
        return JsonResponse(list(modelos), safe=False)

    return JsonResponse([], safe=False)


def productos_disponibles(request):
    """Productos sin asignación activa"""
    productos_asignados_ids = Asignaciones.objects.filter(
        fecha_devolucion__isnull=True
    ).values_list("producto_id", flat=True)

    productos = Productos.objects.select_related(
        "categoria", "modelo", "estado", "proveedor"
    ).exclude(id__in=productos_asignados_ids)

    filter_form = ProductoFilterForm()

    context = {
        "productos": productos,
        "filter_form": filter_form,
        "total_productos": productos.count(),
        "filtro_activo": "disponibles",
    }
    return render(request, "listar_productos.html", context)


def dashboard(request):
    """Dashboard principal del sistema"""
    from django.db.models import Count

    total_productos = Productos.objects.count()
    productos_operativos = Productos.objects.filter(
        estado__nombre="Operativo"
    ).count()
    productos_mantencion = Productos.objects.filter(
        estado__nombre="En Mantención"
    ).count()

    productos_asignados = Asignaciones.objects.filter(
        fecha_devolucion__isnull=True
    ).count()

    total_proveedores = Proveedores.objects.count()
    total_categorias = Categorias.objects.count()
    total_marcas = Marcas.objects.count()
    total_modelos = Modelos.objects.count()

    productos_por_categoria = (
        Categorias.objects.annotate(total=Count("productos"))
        .filter(total__gt=0)
        .order_by("-total")[:5]
    )

    for categoria in productos_por_categoria:
        if total_productos > 0:
            categoria.porcentaje = (categoria.total / total_productos) * 100
        else:
            categoria.porcentaje = 0

    productos_por_estado = (
        Estados.objects.annotate(total=Count("productos"))
        .filter(total__gt=0)
        .order_by("-total")
    )

    for estado in productos_por_estado:
        if total_productos > 0:
            estado.porcentaje = (estado.total / total_productos) * 100
        else:
            estado.porcentaje = 0

    ultimos_productos = Productos.objects.select_related(
        "categoria", "modelo", "estado"
    ).order_by("-fecha_compra")[:5]

    context = {
        "total_productos": total_productos,
        "productos_operativos": productos_operativos,
        "productos_mantencion": productos_mantencion,
        "productos_asignados": productos_asignados,
        "total_proveedores": total_proveedores,
        "total_categorias": total_categorias,
        "total_marcas": total_marcas,
        "total_modelos": total_modelos,
        "productos_por_categoria": productos_por_categoria,
        "productos_por_estado": productos_por_estado,
        "ultimos_productos": ultimos_productos,
    }
    return render(request, "dashboard.html", context)


def reportes(request):
    """Página de reportes (placeholder para futura implementación)"""
    context = {
        "title": "Generador de Reportes",
    }
    return render(request, "reportes.html", context)


def cpu_list(request):
    """Lista de CPUs con filtros"""
    cpus = CPU.objects.all()
    filter_form = CPUFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            cpus = cpus.filter(
                models.Q(marca__icontains=search) | 
                models.Q(modelo__icontains=search)
            )

    cpus = cpus.order_by("marca", "modelo")

    context = {
        "cpus": cpus,
        "filter_form": filter_form,
        "total_cpus": cpus.count(),
    }
    return render(request, "listar_cpu.html", context)


def cpu_create(request):
    """Crear nuevo CPU"""
    if request.method == "POST":
        form = CPUForm(request.POST)

        if form.is_valid():
            cpu = form.save()
            messages.success(
                request, f"CPU {cpu.marca} {cpu.modelo} creado exitosamente."
            )
            return redirect("cpu_list")
        else:
            messages.error(
                request, "Error al crear el CPU. Verifica los datos."
            )
    else:
        form = CPUForm()

    context = {
        "form": form,
        "title": "Agregar CPU",
        "action": "Crear",
    }
    return render(request, "agregar_cpu.html", context)


def cpu_edit(request, pk):
    """Editar CPU existente"""
    cpu = get_object_or_404(CPU, pk=pk)

    if request.method == "POST":
        form = CPUForm(request.POST, instance=cpu)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"CPU {cpu.marca} {cpu.modelo} actualizado exitosamente."
            )
            return redirect("cpu_list")
        else:
            messages.error(request, "Error al actualizar el CPU.")
    else:
        form = CPUForm(instance=cpu)

    context = {
        "form": form,
        "cpu": cpu,
        "title": f"Editar CPU {cpu.marca} {cpu.modelo}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_cpu.html", context)


def cpu_delete(request, pk):
    """Eliminar CPU"""
    cpu = get_object_or_404(CPU, pk=pk)

    if request.method == "POST":
        marca = cpu.marca
        modelo = cpu.modelo
        cpu.delete()
        messages.success(
            request, f"CPU {marca} {modelo} eliminado exitosamente."
        )
        return redirect("cpu_list")

    context = {
        "cpu": cpu,
    }
    return render(request, "eliminar_cpu.html", context)


def gpu_list(request):
    """Lista de GPUs con filtros"""
    gpus = GPU.objects.all()
    filter_form = GPUFilterForm(request.GET)

    if filter_form.is_valid():
        search = filter_form.cleaned_data.get("search")
        if search:
            gpus = gpus.filter(
                models.Q(marca__icontains=search) | 
                models.Q(modelo__icontains=search)
            )

    gpus = gpus.order_by("marca", "modelo")

    context = {
        "gpus": gpus,
        "filter_form": filter_form,
        "total_gpus": gpus.count(),
    }
    return render(request, "listar_gpu.html", context)


def gpu_create(request):
    """Crear nueva GPU"""
    if request.method == "POST":
        form = GPUForm(request.POST)

        if form.is_valid():
            gpu = form.save()
            messages.success(
                request, f"GPU {gpu.marca} {gpu.modelo} creada exitosamente."
            )
            return redirect("gpu_list")
        else:
            messages.error(
                request, "Error al crear la GPU. Verifica los datos."
            )
    else:
        form = GPUForm()

    context = {
        "form": form,
        "title": "Agregar GPU",
        "action": "Crear",
    }
    return render(request, "agregar_gpu.html", context)


def gpu_edit(request, pk):
    """Editar GPU existente"""
    gpu = get_object_or_404(GPU, pk=pk)

    if request.method == "POST":
        form = GPUForm(request.POST, instance=gpu)

        if form.is_valid():
            form.save()
            messages.success(
                request, f"GPU {gpu.marca} {gpu.modelo} actualizada exitosamente."
            )
            return redirect("gpu_list")
        else:
            messages.error(request, "Error al actualizar la GPU.")
    else:
        form = GPUForm(instance=gpu)

    context = {
        "form": form,
        "gpu": gpu,
        "title": f"Editar GPU {gpu.marca} {gpu.modelo}",
        "action": "Actualizar",
    }
    return render(request, "actualizar_gpu.html", context)


def gpu_delete(request, pk):
    """Eliminar GPU"""
    gpu = get_object_or_404(GPU, pk=pk)

    if request.method == "POST":
        marca = gpu.marca
        modelo = gpu.modelo
        gpu.delete()
        messages.success(
            request, f"GPU {marca} {modelo} eliminada exitosamente."
        )
        return redirect("gpu_list")

    context = {
        "gpu": gpu,
    }
    return render(request, "eliminar_gpu.html", context)