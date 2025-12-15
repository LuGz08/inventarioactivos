from django.contrib import admin
from .models import (
    Proveedores, Marcas, Categorias, Modelos, 
    Estados, Productos, Usuarios, Asignaciones, Mantenciones, 
    HistorialEstados, Documentaciones, Notificaciones, LogAcceso, 
    Sucursales, CodigoQR,
    CPU, GPU, Componentes,
)
# Register your models here.


admin.site.register(Proveedores)
admin.site.register(Marcas)
admin.site.register(Categorias)
admin.site.register(Modelos)
admin.site.register(Estados)
admin.site.register(Productos)
admin.site.register(Usuarios)
admin.site.register(Asignaciones)
admin.site.register(Mantenciones)
admin.site.register(HistorialEstados)
admin.site.register(Documentaciones)
admin.site.register(Notificaciones)
admin.site.register(LogAcceso)
admin.site.register(Sucursales)
admin.site.register(CodigoQR)
admin.site.register(CPU)
admin.site.register(GPU)
admin.site.register(Componentes)

class NotificacionAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'categoria', 'producto', 'leido', 'prioridad', 'fecha_creacion']
    list_filter = ['categoria', 'leido', 'prioridad', 'fecha_creacion']
    search_fields = ['titulo', 'mensaje']
    date_hierarchy = 'fecha_creacion'

class ComponentesInline(admin.StackedInline):
    model = Componentes
    extra = 0
    min_num = 0
    max_num = 1  # IMPORTANTE → solo 1 set por producto


class ProductosAdmin(admin.ModelAdmin):
    inlines = [ComponentesInline]
    list_display = ("nro_serie", "categoria", "modelo", "estado_garantia")
    search_fields = ("nro_serie",)
