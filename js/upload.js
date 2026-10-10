document.addEventListener("DOMContentLoaded", function () {
  const inputFotos = document.getElementById("inputFotos");
  const vistaPrevia = document.getElementById("vistaPrevia");
  const formCasa = document.getElementById("formCasa");
  const btnEnviar = document.getElementById("btnEnviar");
  const btnMiUbicacion = document.getElementById("btnMiUbicacion");
  const inputLat = document.getElementById("latitud");
  const inputLng = document.getElementById("longitud");
  const coordenadasTexto = document.getElementById("coordenadasTexto");

  // Coordenadas iniciales (Centro de Satélite Norte, Warnes)
  let latDefault = -17.5855;
  let lngDefault = -63.1612;

  inputLat.value = latDefault;
  inputLng.value = lngDefault;

  // 1. Inicializar mapa Leaflet
  const map = L.map("mapaSelector").setView([latDefault, lngDefault], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // Marcador arrastrable (draggable)
  let marker = L.marker([latDefault, lngDefault], { draggable: true }).addTo(map);

  function actualizarCoordenadas(lat, lng) {
    inputLat.value = lat.toFixed(6);
    inputLng.value = lng.toFixed(6);
    coordenadasTexto.textContent = `📍 Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  // Cuando arrastra el pin
  marker.on("dragend", function (e) {
    const posicion = marker.getLatLng();
    actualizarCoordenadas(posicion.lat, posicion.lng);
  });

  // Cuando hace clic en cualquier punto del mapa
  map.on("click", function (e) {
    marker.setLatLng(e.latlng);
    actualizarCoordenadas(e.latlng.lat, e.latlng.lng);
  });

  // Botón "Usar mi ubicación actual" (GPS del teléfono / navegador)
  btnMiUbicacion.addEventListener("click", function () {
    if (!navigator.geolocation) {
      alert("Tu dispositivo no soporta geolocalización.");
      return;
    }

    btnMiUbicacion.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo...';
    btnMiUbicacion.disabled = true;

    navigator.geolocation.getCurrentPosition(
      function (position) {
        const miLat = position.coords.latitude;
        const miLng = position.coords.longitude;

        map.setView([miLat, miLng], 16);
        marker.setLatLng([miLat, miLng]);
        actualizarCoordenadas(miLat, miLng);

        btnMiUbicacion.innerHTML = '<i class="fa-solid fa-check"></i> Ubicación obtenida';
        setTimeout(() => {
          btnMiUbicacion.innerHTML = '<i class="fa-solid fa-crosshairs text-sm"></i> Usar mi ubicación actual';
          btnMiUbicacion.disabled = false;
        }, 2000);
      },
      function (error) {
        btnMiUbicacion.innerHTML = '<i class="fa-solid fa-crosshairs text-sm"></i> Usar mi ubicación actual';
        btnMiUbicacion.disabled = false;
        alert("No se pudo obtener la ubicación: Permiso denegado o GPS desactivado.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  // Previsualización de imágenes
  inputFotos.addEventListener("change", function () {
    const archivos = this.files;

    if (archivos.length > 4) {
      alert("Solo puedes subir máximo 4 fotos");
      this.value = "";
      vistaPrevia.innerHTML = "";
      return;
    }

    vistaPrevia.innerHTML = "";

    for (let i = 0; i < archivos.length; i++) {
      (function (file) {
        const lector = new FileReader();
        lector.onload = function (e) {
          const div = document.createElement("div");
          div.innerHTML = '<img src="' + e.target.result + '" class="w-full h-28 object-cover rounded-xl border border-gray-200">';
          vistaPrevia.appendChild(div);
        };
        lector.readAsDataURL(file);
      })(archivos[i]);
    }
  });

  // Envío a Supabase con coordenadas
  formCasa.addEventListener("submit", async function (e) {
    e.preventDefault();

    const archivos = inputFotos.files;
    if (!archivos || archivos.length < 1) {
      alert("Debes subir al menos 1 foto");
      return;
    }
    if (archivos.length > 4) {
      alert("Máximo 4 fotos permitidas");
      return;
    }

    if (!supabase) {
      alert("Error: Supabase no está configurado.");
      return;
    }

    btnEnviar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo fotos y publicando...';
    btnEnviar.disabled = true;

    try {
      const imagenesUrls = [];

      for (let i = 0; i < archivos.length; i++) {
        const file = archivos[i];
        const ext = file.name.split('.').pop();
        const nombreArchivo = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('fotos-casas')
          .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('fotos-casas')
          .getPublicUrl(nombreArchivo);

        imagenesUrls.push(publicUrlData.publicUrl);
      }

      const formData = new FormData(formCasa);
      const casaData = {
        nombre_dueno: formData.get("nombre"),
        whatsapp: formData.get("whatsapp"),
        email_dueno: formData.get("email_dueno") || null,
        titulo: formData.get("titulo"),
        direccion: formData.get("direccion"),
        precio: parseFloat(formData.get("precio")),
        tamanio: formData.get("tamanio") ? parseFloat(formData.get("tamanio")) : null,
        habitaciones: parseInt(formData.get("habitaciones")),
        banos: parseInt(formData.get("banos")),
        tipo: formData.get("tipo"),
        descripcion: formData.get("descripcion"),
        imagenes: imagenesUrls,
        latitud: parseFloat(inputLat.value),
        longitud: parseFloat(inputLng.value),
        activo: true
      };

      const { error: insertError } = await supabase.from('casas').insert([casaData]);
      if (insertError) throw insertError;

      window.location.href = "gracias.html";

    } catch (err) {
      console.error(err);
      alert("Error al procesar la publicación: " + err.message);
      btnEnviar.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar en Puertas Abiertas';
      btnEnviar.disabled = false;
    }
  });
});