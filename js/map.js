var map;
var geoJsonLayer;
let municMarkers = {};

document.addEventListener("DOMContentLoaded", function () {
    if (!window.map) {
        window.map = L.map('map').setView([43.6659, -79.4148], 13);

        // Add tile layer
        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png?api_key=22685591-9232-45c7-a495-cfdf0e81ab86', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        }).addTo(map);

        // Create custom panes
        map.createPane('polygonPane');
        map.getPane('polygonPane').style.zIndex = 200;

        map.createPane('pointPane');
        map.getPane('pointPane').style.zIndex = 400;
    }

    // Fetch and add municipality polygons (set to the polygonPane)
    let municipalityLayer;

    fetch('data/muncipalities_poly.geojson')
        .then(response => response.json())
        .then(data => {
            municipalityLayer = L.geoJSON(data, {
                pane: 'polygonPane',
                style: function (feature) {
                    return {
                        fillColor: '#3388ff',
                        color: 'white',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.5
                    };
                }
            }).addTo(map);
        });


    // Fetch and add municipalities point layer (set to the pointPane)
    fetch('data/muncipalities_pt.geojson')
        .then(response => response.json())
        .then(data => {
            populateDropdown(data);
            if (data && data.type === 'FeatureCollection') {
                geoJsonLayer = L.geoJSON(data, {
                    pane: 'pointPane', // Assign to point pane
                    pointToLayer: function (feature, latlng) {
                        let marker = L.circleMarker(latlng, {
                            radius: 8,
                            fillColor: getColor(feature.properties.rank),
                            color: 'white',
                            weight: 1.5,
                            opacity: 1,
                            fillOpacity: 0.9
                        });

                        // Store marker reference in global object
                        municMarkers[feature.properties.CSDNAME] = marker;

                        return marker;
                    },
                    onEachFeature: function (feature, layer) {
                        layer.bindTooltip(feature.properties.CSDNAME + ' (Rank: ' + feature.properties.rank + ')', {
                            permanent: false,
                            direction: "top",
                            className: "municipality-tooltip"
                        });

                        let popupContent =
                        `<img src="images/maple-leaf.svg" alt="Maple Leaf" style="display: block; margin: 0 auto; width: 1.5rem; height: 1.5rem;">
                        <strong>${feature.properties.CSDNAME + ' (Rank: ' + feature.properties.rank + ' out of 20)'}</strong><br>
                        Green Space: ${feature.properties["gs_per_capita"]} m²/person`;

                        layer.bindPopup(popupContent);
                    }
                }).addTo(map);


                // Add event listeners for checkboxes inside DOMContentLoaded listener
                document.getElementById("top5").addEventListener("change", function() {
                    if (this.checked) {
                        addTop5Markers();
                    } else {
                        removeTop5Markers();
                    }
                });

                document.getElementById("bottom5").addEventListener("change", function() {
                    if (this.checked) {
                        addBottom5Markers();
                    } else {
                        removeBottom5Markers();
                    }
                });

                map.fitBounds(geoJsonLayer.getBounds());
            } else {
                console.error('Invalid GeoJSON data');
            }
        })
        .catch(error => console.error('Error loading GeoJSON', error));


    // Function to toggle layer based on zoom
    function updateLayerVisibility() {
        const zoomLevel = map.getZoom();
        if (zoomLevel >= 8) {
            if (municipalityLayer && !map.hasLayer(municipalityLayer)) {
                map.addLayer(municipalityLayer);
            }
        } else {
            if (municipalityLayer && map.hasLayer(municipalityLayer)) {
                map.removeLayer(municipalityLayer);
            }
        }
    }

    // Ensure this event listener is added inside DOMContentLoaded
    map.on('zoomend', updateLayerVisibility);
});



    function getColor(rank) {
        return rank <= 20 ? '#005522' :
               rank <= 40 ? '#0B6838' :
               rank <= 60 ? '#178B4B' :
               rank <= 80 ? '#219D57' :
               rank <= 100 ? '#2DAF64' :
               rank <= 120 ? '#3AC078' :
               rank <= 140 ? '#44e08cff' :
                             '#4dffa0ff';
    }

    function populateDropdown (municData) {
        const dropdown=document.getElementById('municipality-dropdown');

        municData.features.sort((a,b) =>
        a.properties.CSDNAME.localeCompare(b.properties.CSDNAME)
    );

    municData.features.forEach((CSDNAME, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = CSDNAME.properties.CSDNAME
        dropdown.add(option)
    });

    dropdown.addEventListener('change', function()  {
        const selectedIndex = dropdown.value;
        if(selectedIndex!=="") {
            const selectedMunic = municData.features[selectedIndex];
            zoomToMunic(selectedMunic);
        }
    });
    }

    function zoomToMunic(selectedMunic) {
        if (!municipalityLayer) {
            console.error("Municipality layer not loaded yet.");
            return;
        }

        municipalityLayer.eachLayer(function (layer) {
            if (layer.feature.properties.CSDNAME === selectedMunic) {
                map.fitBounds(layer.getBounds());
                return;
            }
        });
    }



    let top5Layer = L.layerGroup();
    let bottom5Layer = L.layerGroup();

    function addTop5Markers() {
        top5Layer.clearLayers();
        top5.forEach(feature => {
            let centroid = turf.centroid(feature);
            let coords = centroid.geometry.coordinates;

            let icon = L.icon({
                iconUrl: `images/top5-rank${feature.properties.rank}.svg`,
                iconSize: [36, 36],
                iconAnchor: [16, 32],
                popupAnchor: [0, 0]
            });


            let marker = L.marker([coords[1], coords[0]], { icon: icon });
            top5Layer.addLayer(marker);
        });

        map.addLayer(top5Layer);
    }

    // Toggle checkbox behavior
    document.getElementById("top5").addEventListener("change", function() {
        if (this.checked) {
            addTop5Markers();
        } else {
            map.removeLayer(top5Layer);
        }
    });

    function addBottom5Markers() {
        bottom5Layer.clearLayers();
        bottom5.forEach(feature => {
            let rank = feature.properties.rank;
            let bottomRank = 159 - rank;

            let centroid = turf.centroid(feature);
            let coords = centroid.geometry.coordinates;

            let icon = L.icon({
                iconUrl: `images/bottom5-rank${feature.properties.rank}.svg`,
                iconSize: [36, 36],
                iconAnchor: [16, 32],
                popupAnchor: [0, 0]
            });


            let marker = L.marker([coords[1], coords[0]], { icon: icon });
            bottom5Layer.addLayer(marker);
        });

        map.addLayer(bottom5Layer);  //
    }

    function removeTop5Markers() {
        map.removeLayer(top5Layer);
    }

    function removeBottom5Markers() {
        map.removeLayer(bottom5Layer);
    }

    document.getElementById("top5").addEventListener("change", function() {
        if (this.checked) {
            addTop5Markers();
        } else {
            removeTop5Markers();
        }
    });

    document.getElementById("bottom5").addEventListener("change", function() {
        if (this.checked) {
            addBottom5Markers();
        } else {
            removeBottom5Markers();
        }
    });


