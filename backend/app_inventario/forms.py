from django import forms
from .models import (
    Proveedores, Marcas, Categorias, 
    Modelos, Estados, Productos,
    CPU, GPU, Componentes, Facturas
)


class ProductoForm(forms.ModelForm):
    """Formulario para crear/editar productos"""
    
    # Campo personalizado para seleccionar marca primero
    marca = forms.ModelChoiceField(
        queryset=Marcas.objects.all(),
        label='Marca',
        widget=forms.Select(attrs={'class': 'form-select', 'id': 'id_marca'}),
        required=True
    )
    
    class Meta:
        model = Productos
        fields = [
            'nro_serie', 
            'fecha_compra', 
            'categoria', 
            'modelo', 
            'estado', 
            'proveedor', 


        ]
        widgets = {
            'nro_serie': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: SN-001-HP-2024'
            }),
            'fecha_compra': forms.DateInput(attrs={
                'class': 'form-control',
                'type': 'date'
            }),
            'categoria': forms.Select(attrs={'class': 'form-select'}),
            'modelo': forms.Select(attrs={
                'class': 'form-select',
                'id': 'id_modelo'
            }),
            'estado': forms.Select(attrs={'class': 'form-select'}),
            'proveedor': forms.Select(attrs={'class': 'form-select'}),

        }
        labels = {
            'nro_serie': 'Número de Serie',
            'fecha_compra': 'Fecha de Compra',

        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Si es una edición (tiene instancia), modificar campos no editables
        if self.instance and self.instance.pk:
            # ============= CAMPOS OCULTOS (no editables) =============
            self.fields['marca'].required = False
            self.fields['marca'].widget = forms.HiddenInput()
            
            self.fields['nro_serie'].required = False
            self.fields['nro_serie'].widget = forms.HiddenInput()
            
            self.fields['categoria'].required = False
            self.fields['categoria'].widget = forms.HiddenInput()
            
            self.fields['modelo'].required = False
            self.fields['modelo'].widget = forms.HiddenInput()

        # Hacer modelo dependiente de marca
        if 'marca' in self.data:
            try:
                marca_id = int(self.data.get('marca'))
                self.fields['modelo'].queryset = Modelos.objects.filter(marca_id=marca_id)
            except (ValueError, TypeError):
                pass
        elif self.instance.pk:
            self.fields['modelo'].queryset = self.instance.modelo.marca.modelos.all()
        else:
            self.fields['modelo'].queryset = Modelos.objects.none()


class ProductoFilterForm(forms.Form):
    """Formulario para filtrar productos"""
    
    search = forms.CharField(
        required=False,
        label='Buscar',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Número de serie, modelo...'
        })
    )
    
    categoria = forms.ModelChoiceField(
        queryset=Categorias.objects.all(),
        required=False,
        label='Categoría',
        empty_label='Todas',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    estado = forms.ModelChoiceField(
        queryset=Estados.objects.all(),
        required=False,
        label='Estado',
        empty_label='Todos',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    proveedor = forms.ModelChoiceField(
        queryset=Proveedores.objects.all(),
        required=False,
        label='Proveedor',
        empty_label='Todos',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    

    solo_disponibles = forms.BooleanField(
        required=False,
        label='Solo productos disponibles',
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
    )


class ProveedorForm(forms.ModelForm):
    """Formulario para crear/editar proveedores"""
    
    class Meta:
        model = Proveedores
        fields = ['nombre', 'rut', 'contacto', 'telefono', 'correo']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'rut': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '12.345.678-9'
            }),
            'contacto': forms.TextInput(attrs={'class': 'form-control'}),
            'telefono': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '+56 9 1234 5678'
            }),
            'correo': forms.EmailInput(attrs={
                'class': 'form-control',
                'placeholder': 'correo@ejemplo.cl'
            }),
        }


class ProveedorFilterForm(forms.Form):
    """Formulario para filtrar proveedores"""
    
    search = forms.CharField(
        required=False,
        label='Buscar',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre, RUT, contacto...'
        })
    )

class CategoriasForm(forms.ModelForm):
    class Meta:
        model = Categorias
        fields = ["nombre", "imagen"]
        widgets = {
            "nombre": forms.TextInput(attrs={"class": "form-control"}),
            "imagen": forms.ClearableFileInput(attrs={"class": "form-control"}),
        }

class CategoriasFilterForm(forms.Form):
    """Formulario para filtrar categorías"""
    
    search = forms.CharField(
        required=False,
        label='Buscar',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre de categoría...'
        })
    )


class MarcasForm(forms.ModelForm):
    """Formulario para crear/editar marcas"""
    
    class Meta:
        model = Marcas
        fields = ['nombre']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
        }


class MarcasFilterForm(forms.Form):
    """Formulario para filtrar marcas"""
    
    search = forms.CharField(
        required=False,
        label='Buscar',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre de marca...'
        })
    )


class ModelosForm(forms.ModelForm):
    """Formulario para crear/editar modelos"""
    
    class Meta:
        model = Modelos
        fields = ['marca', 'nombre']
        widgets = {
            'marca': forms.Select(attrs={'class': 'form-select'}),
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
        }


class ModelosFilterForm(forms.Form):
    """Formulario para filtrar modelos"""
    
    search = forms.CharField(
        required=False,
        label='Buscar',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre de modelo...'
        })
    )
    
    marca = forms.ModelChoiceField(
        queryset=Marcas.objects.all(),
        required=False,
        label='Marca',
        empty_label='Todas',
        widget=forms.Select(attrs={'class': 'form-select'})
    )


class EstadosForm(forms.ModelForm):
    """Formulario para crear/editar estados"""
    
    class Meta:
        model = Estados
        fields = ['nombre', 'descripcion']
        widgets = {
            'nombre': forms.TextInput(attrs={'class': 'form-control'}),
            'descripcion': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3
            }),
        }


class EstadosFilterForm(forms.Form):
    """Formulario para filtrar estados"""
    
    search = forms.CharField(
        required=False,
        label='Buscar',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre de estado...'
        })
    )

class CPUForm(forms.ModelForm):
    class Meta:
        model = CPU
        fields = ['marca', 'modelo']
        widgets = {
            'marca': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: Intel, AMD'
            }),
            'modelo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: Core i7-12700K'
            }),
        }
        labels = {
            'marca': 'Marca',
            'modelo': 'Modelo',
        }

    def clean_marca(self):
        marca = self.cleaned_data.get('marca')
        if not marca or not marca.strip():
            raise forms.ValidationError("La marca no puede estar vacía")
        return marca.strip()

    def clean_modelo(self):
        modelo = self.cleaned_data.get('modelo')
        if not modelo or not modelo.strip():
            raise forms.ValidationError("El modelo no puede estar vacío")
        return modelo.strip()


class CPUFilterForm(forms.Form):
    search = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar por marca o modelo...'
        })
    )

class GPUForm(forms.ModelForm):
    class Meta:
        model = GPU
        fields = ['marca', 'modelo']
        widgets = {
            'marca': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: NVIDIA, AMD'
            }),
            'modelo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: RTX 4090'
            }),
        }
        labels = {
            'marca': 'Marca',
            'modelo': 'Modelo',
        }

    def clean_marca(self):
        marca = self.cleaned_data.get('marca')
        if not marca or not marca.strip():
            raise forms.ValidationError("La marca no puede estar vacía")
        return marca.strip()

    def clean_modelo(self):
        modelo = self.cleaned_data.get('modelo')
        if not modelo or not modelo.strip():
            raise forms.ValidationError("El modelo no puede estar vacío")
        return modelo.strip()


class GPUFilterForm(forms.Form):
    search = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Buscar por marca o modelo...'
        })
    )