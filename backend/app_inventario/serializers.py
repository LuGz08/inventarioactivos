from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Proveedores, Marcas, Categorias, Modelos, Estados, 
    Productos, Usuarios, Asignaciones, Mantenciones, 
    HistorialEstados, Documentaciones, Notificaciones, LogAcceso,
    Sucursales, CodigoQR, Movimientos, CPU, GPU, Componentes,
)

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
# ============= SERIALIZERS BÁSICOS =============
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Campos extra en el payload:
        token["username"] = user.username
        token["is_staff"] = user.is_staff

        return token
class UserSerializer(serializers.ModelSerializer):
    """Serializer para el User de Django"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active']
        read_only_fields = ['id']


class ProveedoresSerializer(serializers.ModelSerializer):
    """Serializer para Proveedores"""
    class Meta:
        model = Proveedores
        fields = '__all__'


class MarcasSerializer(serializers.ModelSerializer):
    """Serializer para Marcas"""
    class Meta:
        model = Marcas
        fields = '__all__'


class CategoriasSerializer(serializers.ModelSerializer):
    """Serializer para Categorías"""
    class Meta:
        model = Categorias
        fields = '__all__'


class ModelosSerializer(serializers.ModelSerializer):
    """Serializer básico para Modelos"""
    marca_nombre = serializers.CharField(source='marca.nombre', read_only=True)
    
    class Meta:
        model = Modelos
        fields = ['id', 'marca', 'marca_nombre', 'nombre']


class EstadosSerializer(serializers.ModelSerializer):
    """Serializer para Estados"""
    class Meta:
        model = Estados
        fields = '__all__'

class SucursalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sucursales
        fields = '__all__'

class CodigoQRSerializer(serializers.ModelSerializer):
    imagen_qr_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CodigoQR
        fields = ['id', 'imagen_qr', 'imagen_qr_url']
    
    def get_imagen_qr_url(self, obj):
        if obj.imagen_qr:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.imagen_qr.url)
            return obj.imagen_qr.url
        return None

# ============= SERIALIZERS DE USUARIOS =============

# ============= SERIALIZERS DE USUARIOS =============

class UsuariosSerializer(serializers.ModelSerializer):
    """
    Serializer para LISTAR / VER usuarios.
    Solo lectura de datos básicos (lo usas en list, retrieve, me).
    """
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    nombre_completo = serializers.SerializerMethodField()
    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)

    class Meta:
        model = Usuarios
        fields = ['id', 'user', 'username', 'email', 'nombre_completo', 'rol', 'is_staff']
        read_only_fields = ['id', 'user', 'username', 'email', 'nombre_completo', 'is_staff']

    def get_nombre_completo(self, obj):
        return obj.user.get_full_name()


class UsuariosCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para CREAR usuarios (incluye creación del User)
    """
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    email = serializers.EmailField(write_only=True)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    is_staff = serializers.BooleanField(write_only=True, default=False)

    class Meta:
        model = Usuarios
        fields = [
            'id',
            'username',
            'password',
            'email',
            'first_name',
            'last_name',
            'rol',
            'is_staff',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        # Extraer datos del User
        username = validated_data.pop('username')
        password = validated_data.pop('password')
        email = validated_data.pop('email')
        first_name = validated_data.pop('first_name')
        last_name = validated_data.pop('last_name')
        is_staff = validated_data.pop('is_staff', False)

        # Crear User de Django
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        user.is_staff = is_staff
        user.save()

        # Crear Usuario personalizado (perfil)
        usuario = Usuarios.objects.create(user=user, **validated_data)
        return usuario


class UsuariosUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para ACTUALIZAR usuarios existentes.
    Permite cambiar nombre, email, is_staff y contraseña.
    """
    email = serializers.EmailField(source='user.email', required=False)
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    is_staff = serializers.BooleanField(source='user.is_staff', required=False)
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'}
    )

    class Meta:
        model = Usuarios
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'rol',
            'is_staff',
            'password',
        ]
        read_only_fields = ['id']

    def update(self, instance, validated_data):
        # Datos anidados del User
        user_data = validated_data.pop('user', {})
        user = instance.user

        # Actualizar campos del User
        for attr in ['email', 'first_name', 'last_name', 'is_staff']:
            if attr in user_data:
                setattr(user, attr, user_data[attr])

        # Cambiar contraseña si viene
        password = validated_data.pop('password', None)
        if password:
            user.set_password(password)

        user.save()

        # Actualizar campos del modelo Usuarios (ej: rol)
        return super().update(instance, validated_data)



# ============= SERIALIZERS DE CPU Y GPU =============
#=================== (COMPONENTES) ===================

class CPUSerializer(serializers.ModelSerializer):
    class Meta:
        model = CPU
        fields = "__all__"

    def validate_marca(self, value):
        """Validar que la marca no esté vacía"""
        if not value or not value.strip():
            raise serializers.ValidationError("La marca no puede estar vacía")
        return value.strip()
    
    def validate_modelo(self, value):
        """Validar que el modelo no esté vacío"""
        if not value or not value.strip():
            raise serializers.ValidationError("El modelo no puede estar vacío")
        return value.strip()

class GPUSerializer(serializers.ModelSerializer):
    class Meta:
        model = GPU
        fields = "__all__"

    def validate_marca(self, value):
        """Validar que la marca no esté vacía"""
        if not value or not value.strip():
            raise serializers.ValidationError("La marca no puede estar vacía")
        return value.strip()
    
    def validate_modelo(self, value):
        """Validar que el modelo no esté vacío"""
        if not value or not value.strip():
            raise serializers.ValidationError("El modelo no puede estar vacío")
        return value.strip()

# ============= SERIALIZERS DE COMPONENTES =============
class ComponentesSerializer(serializers.ModelSerializer):
    cpu = CPUSerializer(read_only=True)
    gpu = GPUSerializer(read_only=True)

    cpu_id = serializers.PrimaryKeyRelatedField(
        source="cpu", queryset=CPU.objects.all(), write_only=True, required=False, allow_null=True  # ✅ Permitir null
    )
    gpu_id = serializers.PrimaryKeyRelatedField(
        source="gpu", queryset=GPU.objects.all(), write_only=True, required=False, allow_null=True  # ✅ Permitir null
    )

    # ⭐ IMPORTANTE: agregar soporte para asignar un producto
    producto_id = serializers.PrimaryKeyRelatedField(
        source="producto",
        queryset=Productos.objects.all(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Componentes
        fields = [
            "id",
            "ram_gb",
            "almacenamiento_gb",
            "cpu", "gpu",
            "cpu_id", "gpu_id",
            "producto_id",
        ]



# ============= SERIALIZERS DE PRODUCTOS =============

class ProductosListSerializer(serializers.ModelSerializer):
    """Serializer para listar productos (información resumida)"""
    proveedor_nombre = serializers.CharField(source='proveedor.nombre', read_only=True)
    modelo_nombre = serializers.SerializerMethodField()
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    estado_nombre = serializers.CharField(source='estado.nombre', read_only=True)
    sucursal = SucursalSerializer(read_only=True)
    codigo_qr = CodigoQRSerializer(read_only=True)  
    componentes = serializers.SerializerMethodField()
    class Meta:
        model = Productos
        fields = [
            'id', 'nro_serie', 'fecha_compra', 
            'proveedor', 'proveedor_nombre',
            'modelo', 'modelo_nombre',
            'categoria', 'categoria_nombre',
            'estado', 'estado_nombre',
            'documento_factura', 'sucursal', 'codigo_qr',
            'garantia_meses', 'estado_garantia',
            'componentes',
        ]
    
    def get_componentes(self, obj):
        """Obtener componentes de forma segura"""
        if not hasattr(obj, 'componentes') or not obj.componentes:
            return None
            
        comp = obj.componentes
        return {
            'ram_gb': comp.ram_gb,
            'almacenamiento_gb': comp.almacenamiento_gb,
            'cpu': {
                'id': comp.cpu.id,
                'marca': comp.cpu.marca,
                'modelo': comp.cpu.modelo
            } if comp.cpu else None,
            'gpu': {
                'id': comp.gpu.id,
                'marca': comp.gpu.marca,
                'modelo': comp.gpu.modelo
            } if comp.gpu else None
        }
    
    def get_modelo_nombre(self, obj):
        return f"{obj.modelo.marca.nombre} {obj.modelo.nombre}"


class ProductosDetailSerializer(serializers.ModelSerializer):
    proveedor = ProveedoresSerializer(read_only=True)
    modelo = ModelosSerializer(read_only=True)
    categoria = CategoriasSerializer(read_only=True)
    estado = EstadosSerializer(read_only=True)
    sucursal = SucursalSerializer(read_only=True)
    componentes = ComponentesSerializer(read_only=True)

    # QR asociado al producto (OneToOne: related_name='qr')
    codigo_qr = CodigoQRSerializer(read_only=True)

    # Datos relacionados
    asignaciones = serializers.SerializerMethodField()
    mantenciones = serializers.SerializerMethodField()
    historial_estados = serializers.SerializerMethodField()

    class Meta:
        model = Productos
        fields = [
            "id",
            "nro_serie",
            "fecha_compra",
            "documento_factura",
            "garantia_meses",
            "fecha_venc_garantia",
            "estado_garantia",
            "proveedor",
            "modelo",
            "categoria",
            "estado",
            "sucursal",
            "componentes",
            "codigo_qr",
            "asignaciones",
            "mantenciones",
            "historial_estados",
        ]

    def get_asignaciones(self, obj):
        """
        Solo asignaciones activas (sin fecha_devolucion).
        Se hace select_related para no spamear la BD.
        """
        qs = obj.asignaciones.select_related("usuario__user").filter(
            fecha_devolucion__isnull=True
        )
        return AsignacionesSerializer(qs, many=True).data

    def get_mantenciones(self, obj):
        """
        Últimas 5 mantenciones del producto.
        """
        qs = obj.mantenciones.select_related("proveedor").all()[:5]
        return MantencionesSerializer(qs, many=True).data

    def get_historial_estados(self, obj):
        """
        Últimos 10 cambios de estado del producto.
        """
        qs = obj.historial_estados.select_related("estado").all()[:10]
        return HistorialEstadosSerializer(qs, many=True).data


class ProductosCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar productos"""
    componentes = ComponentesSerializer(write_only=True, required=False)

    class Meta:
        model = Productos
        fields = '__all__'
    
    def update(self, instance, validated_data):
        componentes_data = validated_data.pop('componentes', None)
        
        # Actualizar producto
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Actualizar o crear componentes
        if componentes_data:
            Componentes.objects.update_or_create(
                producto=instance,
                defaults=componentes_data
            )
        
        return instance


# ============= SERIALIZERS DE ASIGNACIONES =============

class AsignacionesSerializer(serializers.ModelSerializer):
    """Serializer para LISTAR asignaciones"""
    producto_info = serializers.SerializerMethodField()
    usuario_nombre = serializers.SerializerMethodField()
    estado_asignacion = serializers.SerializerMethodField()
    
    class Meta:
        model = Asignaciones
        fields = [
            'id', 'producto', 'producto_info', 
            'usuario', 'usuario_nombre',
            'fecha_asignacion', 'fecha_devolucion',
            'estado_asignacion'
        ]
    
    def get_producto_info(self, obj):
        """Obtiene información del producto con manejo de errores"""
        producto = getattr(obj, "producto", None)
        if not producto:
            return {}

        categoria = getattr(producto, "categoria", None)
        return {
            "nro_serie": getattr(producto, "nro_serie", ""),
            "categoria": getattr(categoria, "nombre", "") if categoria else "",
            "modelo": str(getattr(producto, "modelo", "")),
        }
    
    def get_usuario_nombre(self, obj):
        """Obtiene nombre del usuario con manejo de errores"""
        usuario = getattr(obj, "usuario", None)
        user = getattr(usuario, "user", None) if usuario else None
        if user:
            nombre = user.get_full_name()
            return nombre or user.username
        return ""
    
    def get_estado_asignacion(self, obj):
        return "Activa" if not obj.fecha_devolucion else "Devuelta"


class AsignacionesCreateSerializer(serializers.ModelSerializer):
    """Serializer específico para CREAR asignaciones"""
    
    class Meta:
        model = Asignaciones
        fields = [
            'producto', 
            'usuario',
            'fecha_devolucion'  # Opcional al crear
        ]
    
    def create(self, validated_data):
        """
        Crear una nueva asignación
        """
        # El campo fecha_asignacion se asignará automáticamente por auto_now_add=True
        asignacion = Asignaciones.objects.create(**validated_data)
        
        # Aquí podrías agregar lógica adicional como:
        # - Cambiar el estado del producto a "Asignado"
        # - Crear una notificación
        # - Registrar en el historial
        
        return asignacion

# ============= SERIALIZERS DE MANTENCIONES =============

class MantencionesSerializer(serializers.ModelSerializer):
    producto_nro_serie = serializers.CharField(
        source="producto.nro_serie", read_only=True
    )
    proveedor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Mantenciones
        fields = [
            "id",
            "producto",
            "producto_nro_serie",
            "proveedor",
            "proveedor_nombre",
            "fecha",
            "descripcion",
            "costo",
        ]

    def get_proveedor_nombre(self, obj):
        """
        El proveedor puede ser null (on_delete=SET_NULL), 
        así que lo manejamos sin romper.
        """
        if obj.proveedor:
            return obj.proveedor.nombre
        return ""


# ============= SERIALIZERS DE HISTORIAL =============

class HistorialEstadosSerializer(serializers.ModelSerializer):
    producto_nro_serie = serializers.CharField(
        source="producto.nro_serie", read_only=True
    )
    estado_nombre = serializers.CharField(
        source="estado.nombre", read_only=True
    )

    class Meta:
        model = HistorialEstados
        fields = [
            "id",
            "producto",
            "producto_nro_serie",
            "estado",
            "estado_nombre",
            "fecha",
            "comentario",
        ]
class HistorialEstadosCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear historial (actualiza estado del producto automáticamente)"""
    class Meta:
        model = HistorialEstados
        fields = ['producto', 'estado', 'comentario']
    
    def create(self, validated_data):
        # Crear el registro de historial
        historial = super().create(validated_data)
        
        # Actualizar el estado actual del producto
        producto = validated_data['producto']
        producto.estado = validated_data['estado']
        producto.save()
        
        return historial


# ============= SERIALIZERS DE DOCUMENTACIÓN =============

class DocumentacionesSerializer(serializers.ModelSerializer):
    """Serializer para Documentación"""
    producto_nro_serie = serializers.CharField(source='producto.nro_serie', read_only=True)
    
    class Meta:
        model = Documentaciones
        fields = [
            'id', 'producto', 'producto_nro_serie',
            'tipo_documento', 'nombre_archivo', 'fecha_subida'
        ]
        read_only_fields = ['fecha_subida']


# ============= SERIALIZERS DE NOTIFICACIONES =============
class NotificacionesSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    tiempo_transcurrido = serializers.SerializerMethodField()
    
    class Meta:
        model = Notificaciones
        fields = [
            'id', 'categoria', 'titulo', 'mensaje', 
            'producto', 'producto_nombre', 'fecha_creacion',
            'leido', 'prioridad', 'url_accion', 'tiempo_transcurrido'
        ]
        read_only_fields = ['id', 'fecha_creacion']
    
    def get_tiempo_transcurrido(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.fecha_creacion
        
        if delta.days > 0:
            return f"hace {delta.days} día{'s' if delta.days > 1 else ''}"
        elif delta.seconds // 3600 > 0:
            horas = delta.seconds // 3600
            return f"hace {horas} hora{'s' if horas > 1 else ''}"
        elif delta.seconds // 60 > 0:
            minutos = delta.seconds // 60
            return f"hace {minutos} minuto{'s' if minutos > 1 else ''}"
        else:
            return "hace unos segundos"


# ============= SERIALIZERS DE LOG ACCESO =============

class LogAccesoSerializer(serializers.ModelSerializer):
    """Serializer para Log de Accesos"""
    usuario_nombre = serializers.SerializerMethodField()
    username = serializers.CharField(source='usuario.user.username', read_only=True)
    
    class Meta:
        model = LogAcceso
        fields = ['id', 'usuario', 'usuario_nombre', 'username', 'fecha_hora']
        read_only_fields = ['fecha_hora']
    
    def get_usuario_nombre(self, obj):
        return obj.usuario.user.get_full_name()
    
# ============= SERIALIZERS DE MOVIMIENTOS =============

class MovimientosSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movimientos
        fields = "__all__"



