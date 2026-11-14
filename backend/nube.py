import sqlite3
import json
import networkx as nx
from pyvis.network import Network
import re

# 1. Configuración y conexión
DB_PATH = 'psi_index.db'
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

G = nx.Graph()

# 2. Extraer solo los documentos de tipo 'raw_file'
cursor.execute("SELECT doc_id, title, doc_type, summary, metadata_json FROM documents WHERE doc_type = 'raw_file'")
documentos = cursor.fetchall()

archivos_validos_ids = set()

for doc_id, title, doc_type, summary, metadata_json in documentos:
    meta = {}
    if metadata_json:
        try:
            meta = json.loads(metadata_json)
        except json.JSONDecodeError:
            pass
            
    filename = meta.get("filename", "")
    filename_lower = filename.lower()
    
    # FILTRO: Solo CSV y TXT
    if filename_lower.endswith('.csv') or filename_lower.endswith('.txt'):
        archivos_validos_ids.add(doc_id)
        
        label = filename if filename else (title if title else str(doc_id))
        hover_title = f"ID: {doc_id}\nTitle: {title}\nSummary: {summary}"
        
        if filename_lower.endswith('.csv'):
            color_nodo = '#fc3d21'  # Rojo NASA
            grupo = 'archivo_csv'
        else:
            color_nodo = '#60a5fa'  # Azul moderno
            grupo = 'archivo_txt'
            
        G.add_node(doc_id, 
                   label=label, 
                   title=hover_title, 
                   group=grupo,
                   color=color_nodo,
                   size=20) 

# 3. Extraer etiquetas y crear Conexiones
cursor.execute("SELECT doc_id, tag FROM document_tags")
etiquetas_rels = cursor.fetchall()

relaciones_validas = [(doc, tag) for doc, tag in etiquetas_rels if doc in archivos_validos_ids]

for doc_id, tag in relaciones_validas:
    if not G.has_node(tag):
        G.add_node(tag, 
                   label=tag, 
                   title=f"Taxonomy tag: {tag}", 
                   group='etiqueta',
                   color='#eab308', # Amarillo cálido
                   size=12)
    
    G.add_edge(doc_id, tag)

conn.close()

# 4. Configurar la visualización "VIVA" estilo espacio
net = Network(height='100vh', width='100%', font_color='#D1D5DB', bgcolor='#09090b')
net.from_nx(G)

opciones_interfaz = """
var options = {
  "nodes": {
    "borderWidth": 0,
    "borderWidthSelected": 2,
    "font": { "color": "#9CA3AF", "face": "Inter, -apple-system, sans-serif", "size": 13 }
  },
  "edges": {
    "color": {
      "color": "rgba(255, 255, 255, 0.35)",
      "highlight": "rgba(252, 61, 33, 0.9)",
      "hover": "rgba(255, 255, 255, 0.75)"
    },
    "width": 1.5,
    "smooth": { "type": "continuous" }
  },
  "interaction": {
    "hover": true
  },
  "physics": {
    "enabled": true,
    "solver": "barnesHut",
    "barnesHut": {
      "gravitationalConstant": -4500,
      "centralGravity": 0.08,
      "springLength": 220,
      "springConstant": 0.015,
      "damping": 0.04,
      "avoidOverlap": 0.2
    },
    "minVelocity": 0.01,
    "stabilization": {
      "enabled": false
    }
  }
}
"""
net.set_options(opciones_interfaz)

salida_html = 'galaxia_obsidian.html'
net.write_html(salida_html)

# 5. POST-PROCESAMIENTO: Fondo espacial + Flotación continua
with open(salida_html, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Limpiar Bootstrap de PyVis
html_content = html_content.replace('<div class="card" style="width: 100%">', '<div style="width: 100%; height: 100vh; padding: 0; margin: 0;">')
html_content = html_content.replace('class="card-body"', '')

# Eliminar estilos inyectados por defecto de #mynetwork
html_content = re.sub(r'<style type="text/css">.*?#mynetwork\s*\{.*?\}.*?</style>', '', html_content, flags=re.DOTALL)

estilos_y_leyenda = """
<style>
  html, body, #mynetwork {
    width: 100% !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    /* Fondo oscuro espacial (cámbialo a transparent solo si el iframe padre ya es oscuro) */
    background: radial-gradient(circle at center, #11131a 0%, #07080b 100%) !important;
    border: none !important;
    outline: none !important;
  }
  
  .custom-legend {
    position: absolute; top: 24px; left: 24px; z-index: 9999;
    background: rgba(24, 24, 27, 0.65); backdrop-filter: blur(12px);
    padding: 18px 24px; border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08); color: #E5E7EB;
    font-family: Inter, -apple-system, sans-serif;
  }
  .custom-legend h3 { margin: 0 0 14px 0; font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; }
  .legend-item { margin-bottom: 12px; display: flex; align-items: center; font-size: 13px; }
  .legend-item:last-child { margin-bottom: 0; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 14px; }
</style>

<div class="custom-legend">
    <h3>Data Network</h3>
    <div class="legend-item"><span class="legend-dot" style="background-color: #fc3d21; box-shadow: 0 0 8px #fc3d21;"></span> Raw .CSV</div>
    <div class="legend-item"><span class="legend-dot" style="background-color: #60a5fa; box-shadow: 0 0 8px #60a5fa;"></span> Raw .TXT</div>
    <div class="legend-item"><span class="legend-dot" style="background-color: #eab308; box-shadow: 0 0 8px #eab308;"></span> Taxonomía</div>
</div>
"""

# Script para simular micro-gravedad constante y evitar que el grafo se congele
script_flotacion = """
<script>
  window.addEventListener('load', function() {
    if (typeof network === 'undefined') return;

    const nodesDataset = network.body.data.nodes;
    const edgesDataset = network.body.data.edges;

    // Guardar estado original de cada nodo para poder restaurarlo
    const originalNodes = {};
    nodesDataset.get().forEach(n => {
      originalNodes[String(n.id)] = {
        color: n.color,
        size: n.size || 16,
        fontColor: (n.font && n.font.color) || '#9CA3AF',
        fontSize: (n.font && n.font.size) || 13
      };
    });

    // Flotación continua en microgravedad
    let t = 0;
    network.on("beforeDrawing", function() {
      t += 0.015;
      const nodeIds = Object.keys(network.body.nodes);
      for (let i = 0; i < nodeIds.length; i++) {
        const node = network.body.nodes[nodeIds[i]];
        if (node && !node.options.fixed) {
          node.vx += Math.sin(t + i) * 0.015;
          node.vy += Math.cos(t + i * 1.3) * 0.015;
        }
      }
    });

    setInterval(function() {
      network.startSimulation();
    }, 2000);

    // Escuchar resultados de búsqueda desde React (LibraryPage.jsx)
    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'HIGHLIGHT_NODES') {
        const matchedSet = new Set((msg.nodeIds || []).map(String));
        const neighborSet = new Set();
        const existingMatchedIds = [];

        nodesDataset.get().forEach(n => {
          const idStr = String(n.id);
          if (matchedSet.has(idStr)) {
            existingMatchedIds.push(n.id);
            network.getConnectedNodes(n.id).forEach(nb => neighborSet.add(String(nb)));
          }
        });

        // Actualizar nodos: iluminar coincidencias, resaltar etiquetas vecinas y atenuar el resto
        const updatedNodes = nodesDataset.get().map(n => {
          const idStr = String(n.id);
          const orig = originalNodes[idStr];
          if (matchedSet.has(idStr)) {
            return {
              id: n.id,
              opacity: 1,
              size: orig.size * 1.65,
              color: orig.color,
              shadow: { enabled: true, color: '#fc3d21', size: 28, x: 0, y: 0 },
              font: { color: '#ffffff', size: 16, bold: true }
            };
          }
          if (neighborSet.has(idStr)) {
            return {
              id: n.id,
              opacity: 0.9,
              size: orig.size * 1.15,
              color: orig.color,
              shadow: { enabled: true, color: 'rgba(234, 179, 8, 0.5)', size: 12, x: 0, y: 0 },
              font: { color: '#fde047', size: 14, bold: false }
            };
          }
          return {
            id: n.id,
            opacity: 0.14,
            size: orig.size * 0.85,
            shadow: { enabled: false },
            font: { color: 'rgba(156, 163, 175, 0.18)', size: orig.fontSize }
          };
        });
        nodesDataset.update(updatedNodes);

        // Iluminar las conexiones de los nodos encontrados
        const updatedEdges = edgesDataset.get().map(e => {
          const isRelevant = matchedSet.has(String(e.from)) || matchedSet.has(String(e.to));
          return {
            id: e.id,
            color: { color: isRelevant ? 'rgba(252, 61, 33, 0.8)' : 'rgba(255, 255, 255, 0.04)' },
            width: isRelevant ? 2.4 : 1
          };
        });
        edgesDataset.update(updatedEdges);

        // Enfocar cámara suavemente sobre los resultados
        if (existingMatchedIds.length > 0) {
          network.fit({
            nodes: existingMatchedIds,
            animation: { duration: 850, easingFunction: 'easeInOutQuad' }
          });
        }
      }

      if (msg.type === 'RESET_HIGHLIGHT') {
        const restoredNodes = nodesDataset.get().map(n => {
          const orig = originalNodes[String(n.id)];
          return {
            id: n.id,
            opacity: 1,
            size: orig.size,
            color: orig.color,
            shadow: { enabled: false },
            font: { color: orig.fontColor, size: orig.fontSize, bold: false }
          };
        });
        nodesDataset.update(restoredNodes);

        const restoredEdges = edgesDataset.get().map(e => ({
          id: e.id,
          color: { color: 'rgba(255, 255, 255, 0.35)' },
          width: 1.5
        }));
        edgesDataset.update(restoredEdges);

        network.fit({ animation: { duration: 700, easingFunction: 'easeInOutQuad' } });
      }
    });
  });
</script>
</body>
"""

html_content = re.sub(r'<body[^>]*>', f'<body>\n{estilos_y_leyenda}', html_content, count=1, flags=re.IGNORECASE)
html_content = html_content.replace('</body>', script_flotacion)

with open(salida_html, 'w', encoding='utf-8') as f:
    f.write(html_content)

print("¡HTML generado!")
