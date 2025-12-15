from django.core.files import File
from django.conf import settings
from django.urls import reverse
from io import BytesIO
import qrcode
from django.db import models
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model


class Proveedores(models.Model):
    """Proveedores de productos tecnológicos"""
    nombre = models.CharField(max_length=200)
    rut = models.CharField(max_length=12, unique=True)
    contacto = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20)
    correo = models.EmailField()

    class Meta:
        verbose_name_plural = "Proveedores"

    def __str__(self):
        return f"{self.nombre} ({self.rut})"


class Marcas(models.Model):
    """Marcas de productos (HP, Dell, Lenovo, etc.)"""
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name_plural = "Marcas"

    def __str__(self):
        return self.nombre


class Categorias(models.Model):
    """Categorías de productos (Computadores, Impresoras, Tablets, etc.)"""
    nombre = models.CharField(max_length=100, unique=True)
    imagen =models.ImageField(upload_to='categorias/', blank=True, null=True)
    class Meta:
        verbose_name_plural = "Categorías"

    def __str__(self):
        return self.nombre


class Modelos(models.Model):
    """Modelos específicos de productos"""
    marca = models.ForeignKey(Marcas, on_delete=models.CASCADE, related_name='modelos')
    nombre = models.CharField(max_length=200)

    class Meta:
        verbose_name_plural = "Modelos"
        unique_together = ['marca', 'nombre']

    def __str__(self):
        return f"{self.marca.nombre} {self.nombre}"


class Estados(models.Model):
    """Estados posibles de los productos (Operativo, En Mantención, Dado de Baja, etc.)"""
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Estados"

    def __str__(self):
        return self.nombre
    

class Sucursales(models.Model):
    """Sucursales a las que pertenecen los productos"""
    nombre = models.CharField(max_length=200, unique=True)
    direccion = models.CharField(max_length=300, blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        verbose_name_plural = "Sucursales"

    def __str__(self):
        return self.nombre


class Productos(models.Model):
    """Productos/Activos tecnológicos"""

    nro_serie = models.CharField(max_length=100, unique=True, verbose_name="Número de Serie")
    fecha_compra = models.DateField()
    estado = models.ForeignKey(Estados, on_delete=models.PROTECT, related_name='productos')
    documento_factura = models.CharField(max_length=200, blank=True, null=True)
    
    # Campos de garantía
    garantia_meses = models.PositiveIntegerField(default=12)  
    fecha_venc_garantia = models.DateField(blank=True, null=True)

    ESTADOS_GARANTIA = [
        ('VIGENTE', 'Vigente'),
        ('VENCIDA', 'Vencida'),
        ('NO_APLICA', 'No aplica')
    ]
    estado_garantia = models.CharField(max_length=20, choices=ESTADOS_GARANTIA, default='VIGENTE')


    # Relaciones
    proveedor = models.ForeignKey(Proveedores, on_delete=models.PROTECT, related_name='productos')
    modelo = models.ForeignKey(Modelos, on_delete=models.PROTECT, related_name='productos')
    categoria = models.ForeignKey(Categorias, on_delete=models.PROTECT, related_name='productos')
    sucursal = models.ForeignKey(Sucursales, on_delete=models.PROTECT, null=True, blank=True, related_name='productos')

    class Meta:
        verbose_name_plural = "Productos"

    def save(self, *args, **kwargs):
        """Calcular fecha de vencimiento de garantía automáticamente."""
        from datetime import timedelta
        from django.utils import timezone

        if self.fecha_compra and self.garantia_meses:
            # Calcular vencimiento
            self.fecha_venc_garantia = self.fecha_compra + timedelta(days=self.garantia_meses * 30)

            # Actualizar estado
            hoy = timezone.now().date()
            if hoy > self.fecha_venc_garantia:
                self.estado_garantia = 'VENCIDA'
            else:
                self.estado_garantia = 'VIGENTE'

        super().save(*args, **kwargs)


    def __str__(self):
        return f"{self.categoria} - {self.nro_serie} ({self.modelo})"


class Usuarios(models.Model):
    """Usuarios del sistema (empleados que usan los productos)"""
    ROLES = [
        ('ADMIN', 'Administrador'),
        ('USUARIO', 'Usuario'),
    ]

    #Llamamos al user default de django que contiene:
        # Campos principales:
        #user.username          # Nombre de usuario (único, requerido)
        #user.password          # Contraseña hasheada (nunca en texto plano)
        #user.email             # Email
        #user.first_name        # Nombre
        #user.last_name         # Apellido

        # Campos de estado:
        #user.is_active         # Usuario activo (True/False)
        #user.is_staff          # Puede acceder al admin (True/False)
        #user.is_superuser      # Superusuario con todos los permisos

        # Fechas:
        #user.date_joined       # Fecha de registro
        #user.last_login        # Último login

        # Métodos útiles:
        #user.get_full_name()   # Retorna "Nombre Apellido"
        #user.set_password('nueva_pass')  # Hashea y guarda contraseña
        #user.check_password('pass')      # Verifica si la contraseña es correcta

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil_usuario')
    rol = models.CharField(max_length=20, choices=ROLES, default='USUARIO')
    

    
    def __str__(self):
        return f"{self.user.get_full_name()} ({self.user.username})"

class Asignaciones(models.Model):
    """Asignación de productos a usuarios"""
    producto = models.ForeignKey(Productos, on_delete=models.CASCADE, related_name='asignaciones')
    usuario = models.ForeignKey(Usuarios, on_delete=models.CASCADE, related_name='asignaciones')
    fecha_asignacion = models.DateField(auto_now_add=True)
    fecha_devolucion = models.DateField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Asignaciones"

    def __str__(self):
        estado = "Activa" if not self.fecha_devolucion else "Devuelta"
        return f"{self.producto.nro_serie} → {self.usuario} ({estado})"


class Mantenciones(models.Model):
    """Mantenciones realizadas a los productos"""
    producto = models.ForeignKey(Productos, on_delete=models.CASCADE, related_name='mantenciones')
    fecha = models.DateField()
    detalle = models.TextField()
    proveedor = models.ForeignKey(Proveedores, on_delete=models.SET_NULL, null=True, blank=True, related_name='mantenciones')

    class Meta:
        verbose_name_plural = "Mantenciones"
        ordering = ['-fecha']

    def __str__(self):
        return f"Mantención {self.producto.nro_serie} - {self.fecha}"

class Movimientos(models.Model):
    """
    Movimientos de stock (entradas, salidas, ajustes).
    No modifican directamente el producto, pero dejan un registro histórico.
    """

    TIPO_CHOICES = [
        ("entrada", "Entrada"),
        ("salida", "Salida"),
        ("ajuste", "Ajuste"),
    ]

    fecha = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)

    # SKU / número de serie del producto (texto libre)
    sku = models.CharField(max_length=100)

    # Cantidad involucrada en el movimiento
    cantidad = models.PositiveIntegerField(default=1)

    # Datos adicionales libres (texto)
    proveedor = models.CharField(max_length=200, blank=True)
    referencia = models.CharField(max_length=200, blank=True)
    comentarios = models.TextField(blank=True)

    # Usuario que realizó el movimiento (opcional)
    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos",
    )

    class Meta:
        verbose_name = "Movimiento"
        verbose_name_plural = "Movimientos"
        ordering = ["-fecha"]

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.sku} x{self.cantidad} ({self.fecha.strftime('%d/%m/%Y %H:%M')})"

class HistorialEstados(models.Model):
    """Historial de cambios de estado de los productos"""
    producto = models.ForeignKey(Productos, on_delete=models.CASCADE, related_name='historial_estados')
    fecha = models.DateTimeField(auto_now_add=True)
    estado = models.ForeignKey(Estados, on_delete=models.PROTECT, related_name='historiales')
    comentario = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Historial de Estados"
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.producto.nro_serie} → {self.estado.nombre} ({self.fecha.strftime('%d/%m/%Y %H:%M')})"


class Documentaciones(models.Model):
    """Documentación asociada a productos"""
    producto = models.ForeignKey(Productos, on_delete=models.CASCADE, related_name='documentos')
    tipo_documento = models.CharField(max_length=100)
    nombre_archivo = models.CharField(max_length=255)
    fecha_subida = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Documentación"

    def __str__(self):
        return f"{self.tipo_documento} - {self.nombre_archivo}"



User = get_user_model()
class Notificaciones(models.Model):

    CATEGORIAS = [
        ("mantenimiento", "Mantenimiento"),
        ("garantia", "Garantía"),
    ]

    # Relaciones
    producto = models.ForeignKey(
        'Productos',
        on_delete=models.CASCADE,
        related_name='notificaciones',
        null=True,
        blank=True
    )
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notificaciones',
        null=True,
        blank=True
    )

    categoria = models.CharField(max_length=30, choices=CATEGORIAS, null=True, blank=True)
    titulo = models.CharField(max_length=200, null=True, blank=True)
    mensaje = models.TextField()

    fecha_creacion = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    leido = models.BooleanField(default=False)
    fecha_lectura = models.DateTimeField(null=True, blank=True)

    prioridad = models.CharField(
        max_length=10,
        choices=[('baja', 'Baja'), ('media', 'Media'), ('alta', 'Alta')],
        default='media'
    )
    url_accion = models.CharField(max_length=500, blank=True)

    class Meta:
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ['-fecha_creacion']
        # Indexes: NO usar "-" dentro de fields
        indexes = [
            models.Index(fields=['fecha_creacion']),
            models.Index(fields=['usuario', 'leido']),
        ]

    def __str__(self):
        return f"{self.categoria.upper()}: {self.titulo}"

    def marcar_como_leida(self):
        """Marca la notificación como leída"""
        from django.utils import timezone
        self.leido = True
        self.fecha_lectura = timezone.now()
        self.save()


class LogAcceso(models.Model):
    """Log de accesos al sistema"""
    usuario = models.ForeignKey(Usuarios, on_delete=models.CASCADE, related_name='logs_acceso')
    fecha_hora = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Logs de Acceso"
        ordering = ['-fecha_hora']

    def __str__(self):
        return f"{self.usuario.usuario_login} - {self.fecha_hora.strftime('%d/%m/%Y %H:%M:%S')}"
    

class CodigoQR(models.Model):
    producto = models.OneToOneField(
        Productos, 
        on_delete=models.CASCADE,
        related_name='codigo_qr'
    )
    imagen_qr = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    
    def generar_qr(self):
        relative_url = "paginas/producto/detalle.html?id=" + str(self.producto.id)
        base = "localhost:5500/"
        full_url = f"{base}{relative_url}"

        print("URL GENERADA:", full_url)

        # Crear QR
        qr = qrcode.make(full_url)
        buffer = BytesIO()
        qr.save(buffer, format='PNG')
        buffer.seek(0)

        filename = f"qr_producto_{self.producto.id}.png"
        self.imagen_qr.save(filename, File(buffer), save=False)

##########################################
# 
# TABLAS PARA MANEJAR ESPECIFICACIONES
#
##########################################

class CPU(models.Model):
    marca = models.CharField(max_length=100)
    modelo = models.CharField(max_length=200)

    def __str__(self):
        return f"{self.marca} {self.modelo}"


class GPU(models.Model):
    marca = models.CharField(max_length=100)
    modelo = models.CharField(max_length=200)

    def __str__(self):
        return f"{self.marca} {self.modelo}"
    

class Componentes(models.Model):
    producto = models.OneToOneField(Productos, on_delete=models.CASCADE, related_name="componentes")

    ram_gb = models.PositiveIntegerField(null=True, blank=True)
    almacenamiento_gb = models.PositiveIntegerField(null=True, blank=True)

    cpu = models.ForeignKey(CPU, on_delete=models.SET_NULL, null=True, blank=True, related_name="componentes")
    gpu = models.ForeignKey(GPU, on_delete=models.SET_NULL, null=True, blank=True, related_name="componentes")

    def __str__(self):
        return f"Componentes de {self.producto.nro_serie}"