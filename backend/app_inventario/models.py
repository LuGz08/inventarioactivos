from django.core.files import File
from django.conf import settings
from django.urls import reverse
from io import BytesIO
import qrcode
from django.db import models
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from datetime import timedelta, date
from django.utils import timezone
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
    imagen = models.ImageField(upload_to='categorias/', blank=True, null=True)

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
class Facturas(models.Model):
    """Facturas de compra de productos"""
    numero_factura = models.CharField(max_length=100, unique=True, verbose_name="Número de Factura")
    fecha_emision = models.DateField()
    proveedor = models.ForeignKey(Proveedores, on_delete=models.PROTECT, related_name='facturas', null=True)
    monto_total = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Monto Total")
    archivo = models.FileField(upload_to='facturas/', blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Factura"
        verbose_name_plural = "Facturas"
        ordering = ['-fecha_emision']

    def __str__(self):
        return f"{self.numero_factura} - {self.proveedor.nombre}"

# ==========================================
# MODELO PRODUCTOS MEJORADO (GARANTÍAS)
# ==========================================
class Productos(models.Model):
    """Productos/Activos tecnológicos con lógica de garantía"""

    nro_serie = models.CharField(max_length=100, unique=True, verbose_name="Número de Serie")
    fecha_compra = models.DateField()
    estado = models.ForeignKey(Estados, on_delete=models.PROTECT, related_name='productos')
    
    valor_compra = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    
    facturas = models.ManyToManyField(Facturas, related_name='productos', blank=True, verbose_name="Facturas asociadas")
    
    # --- CAMPOS DE GARANTÍA ---
    garantia_meses = models.PositiveIntegerField(default=12, verbose_name="Meses de Garantía")  
    fecha_venc_garantia = models.DateField(blank=True, null=True, verbose_name="Vencimiento Garantía")

    ESTADOS_GARANTIA = [
        ('VIGENTE', 'Vigente'),
        ('POR_VENCER', 'Por Vencer'), # Nuevo estado (alerta)
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
        """Calcula automáticamente el vencimiento y estado de la garantía al guardar"""
        if self.fecha_compra and self.garantia_meses is not None:
            # 1. Calcular vencimiento (Fecha Compra + (Meses * 30 días))
            self.fecha_venc_garantia = self.fecha_compra + timedelta(days=self.garantia_meses * 30)

            # 2. Determinar estado según fecha actual
            hoy = timezone.now().date()
            dias_restantes = (self.fecha_venc_garantia - hoy).days

            if dias_restantes < 0:
                self.estado_garantia = 'VENCIDA'
            elif dias_restantes <= 30: # Alerta si queda menos de un mes
                self.estado_garantia = 'POR_VENCER'
            else:
                self.estado_garantia = 'VIGENTE'
        else:
            self.fecha_venc_garantia = None
            self.estado_garantia = 'NO_APLICA'

        super().save(*args, **kwargs)

    @property
    def dias_restantes_garantia(self):
        """Propiedad virtual para usar en frontend/serializers"""
        if self.fecha_venc_garantia:
            hoy = timezone.now().date()
            return (self.fecha_venc_garantia - hoy).days
        return 0

    def __str__(self):
        return f"{self.categoria} - {self.nro_serie} ({self.modelo})"
class Usuarios(models.Model):
    """Usuarios del sistema (empleados que usan los productos)"""
    ROLES = [
        ('ADMIN', 'Administrador'),
        ('USUARIO', 'Usuario'),
    ]

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
        # usuario → Usuarios → user (User de Django)
        return f"{self.usuario.user.username} - {self.fecha_hora.strftime('%d/%m/%Y %H:%M:%S')}"
    

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
