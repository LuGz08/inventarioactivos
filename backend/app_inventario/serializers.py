from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Proveedores, Marcas, Categorias, Modelos, Estados, 
    Productos, Usuarios, Asignaciones, Mantenciones, 
    HistorialEstados, Documentaciones, Notificaciones, LogAcceso,
    Sucursales, CodigoQR, Movimientos, CPU, GPU, Componentes, Facturas
)

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# ============= AUTH TOKEN =============

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Campos extra en el payload:
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        return token


# ============= SERIALIZERS BÁSICOS =============

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

class UsuariosSerializer(serializers.ModelSerializer):
    """
    Serializer para LISTAR / VER usuarios.
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

# app_inventario/serializers.py

class FacturaSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Facturas
        fields = [
            "id",
            "numero_factura",
            "fecha_emision",
            "proveedor",
            "monto_total",
            "archivo",
            "archivo_url",
            "observaciones",
        ]

    def get_archivo_url(self, obj):
        if not obj.archivo:
            return None
        request = self.context.get("request")
        url = obj.archivo.url
        return request.build_absolute_uri(url) if request else url
    archivo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Facturas
        fields = [
            "id",
            "numero_factura",
            "fecha_emision",
            "monto_total",
            "archivo",
            "archivo_url",
            "proveedor",
            "observaciones",
            "fecha_registro",
        ]
        read_only_fields = ["fecha_registro", "archivo_url"]

    def get_archivo_url(self, obj):
        if not obj.archivo:
            return None
        request = self.context.get("request")
        url = obj.archivo.url
        return request.build_absolute_uri(url) if request else url
class ProductosListSerializer(serializers.ModelSerializer):
    """Serializer para listar productos con estado de garantía"""
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    estado_nombre = serializers.CharField(source="estado.nombre", read_only=True)
    modelo_nombre = serializers.SerializerMethodField()
    sucursal = SucursalSerializer(read_only=True)
    codigo_qr = CodigoQRSerializer(read_only=True)
    componentes = serializers.SerializerMethodField()
    facturas_info = serializers.SerializerMethodField()
    valor_compra = serializers.SerializerMethodField()
    
    # NUEVO: Días restantes de garantía
    dias_restantes = serializers.IntegerField(source='dias_restantes_garantia', read_only=True)

    class Meta:
        model = Productos
        fields = [
            "id", "nro_serie", "fecha_compra", 
            "garantia_meses", "fecha_venc_garantia", "estado_garantia", "dias_restantes",
            "proveedor", "proveedor_nombre", "modelo", "modelo_nombre", 
            "categoria", "categoria_nombre", "estado", "estado_nombre", 
            "sucursal", "codigo_qr", "componentes", "valor_compra", "facturas_info"
        ]

    def get_modelo_nombre(self, obj):
        try: return f"{obj.modelo.marca.nombre} {obj.modelo.nombre}".strip()
        except: return None

    def get_componentes(self, obj):
        comp = getattr(obj, "componentes", None)
        if not comp: return None
        return {
            "ram_gb": comp.ram_gb, "almacenamiento_gb": comp.almacenamiento_gb,
            "cpu": {"marca": comp.cpu.marca, "modelo": comp.cpu.modelo} if comp.cpu else None,
            "gpu": {"marca": comp.gpu.marca, "modelo": comp.gpu.modelo} if comp.gpu else None,
        }

    def get_facturas_info(self, obj):
        return [{"id": f.id, "numero": f.numero_factura, "fecha": f.fecha_emision} for f in obj.facturas.all()]

    def get_valor_compra(self, obj): return obj.valor_compra

class ProductosDetailSerializer(serializers.ModelSerializer):
    # (Mantén tus campos anidados como antes)
    proveedor = ProveedoresSerializer(read_only=True)
    modelo = ModelosSerializer(read_only=True)
    categoria = CategoriasSerializer(read_only=True)
    estado = EstadosSerializer(read_only=True)
    sucursal = SucursalSerializer(read_only=True)
    componentes = ComponentesSerializer(read_only=True)
    codigo_qr = CodigoQRSerializer(read_only=True)
    facturas = FacturaSerializer(many=True, read_only=True)
    
    # NUEVO: Días restantes
    dias_restantes = serializers.IntegerField(source='dias_restantes_garantia', read_only=True)

    class Meta:
        model = Productos
        fields = [
            "id", "nro_serie", "fecha_compra", 
            "garantia_meses", "fecha_venc_garantia", "estado_garantia", "dias_restantes",
            "proveedor", "modelo", "categoria", "estado", "sucursal",
            "componentes", "codigo_qr", "facturas", "valor_compra"
        ]

class ProductosCreateUpdateSerializer(serializers.ModelSerializer):
    componentes = ComponentesSerializer(write_only=True, required=False)
    facturas_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Productos
        fields = [
            "id", "nro_serie", "fecha_compra", 
            "garantia_meses",  # Entrada usuario
            "fecha_venc_garantia", # Salida calculada
            "estado_garantia",     # Salida calculada
            "proveedor", "modelo", "categoria", "estado", "sucursal",
            "componentes", "facturas_ids", "valor_compra"
        ]
        read_only_fields = ['fecha_venc_garantia', 'estado_garantia'] # El usuario no las edita directo

    def create(self, validated_data):
        componentes_data = validated_data.pop("componentes", None)
        facturas_ids = validated_data.pop("facturas_ids", [])
        producto = Productos.objects.create(**validated_data)
        
        if facturas_ids: producto.facturas.set(facturas_ids)
        if componentes_data:
            from .models import Componentes
            Componentes.objects.update_or_create(producto=producto, defaults=componentes_data)
        return producto

    def update(self, instance, validated_data):
        componentes_data = validated_data.pop("componentes", None)
        facturas_ids = validated_data.pop("facturas_ids", None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save() # Aquí se dispara el cálculo de garantía

        if facturas_ids is not None: instance.facturas.set(facturas_ids)
        if componentes_data:
            from .models import Componentes
            Componentes.objects.update_or_create(producto=instance, defaults=componentes_data)
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
            'fecha_devolucion'
        ]
    
    def create(self, validated_data):
        asignacion = Asignaciones.objects.create(**validated_data)
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
            "detalle",     # <- coincide con el modelo
        ]

    def get_proveedor_nombre(self, obj):
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
        historial = super().create(validated_data)
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
    producto_nombre = serializers.CharField(source='producto.nro_serie', read_only=True)
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


