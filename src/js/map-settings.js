
gisportal.map_settings = {};

gisportal.map_settings.init = function() {

   gisportal.createBaseLayers();
   gisportal.createCountryBorderLayers();
   gisportal.createGraticules();
   

   // load the template and set values for base map options and country border options
   var layers = [];
   
   var layer = {};
   layer.id = 'none';
   layer.name = 'No map';
   layer.description = 'plain black background';
   layers.push(layer);

   _.forEach(gisportal.baseLayers, function(d)  {
      var layer = {};
      layer.id = d.getProperties().id;
      layer.name = d.getProperties().title;
      layer.description = d.getProperties().description;
      layers.push(layer);
   });

   var borders = [];
   borders.push({id:'0', name: 'None'});

   _.forEach(gisportal.countryBorderLayers, function(d) {
   	var border = {};
      border.id = d.getProperties().id;
      border.name = d.getProperties().title;
      borders.push(border);
   })

   var projections = [];
   _.forEach(gisportal.availableProjections, function(d) {
      projections.push(d)
   })
   var data = {
      baseLayers: layers,
      countryBorders: borders,
      projections: projections,
      user_clearance:gisportal.userPermissions.user_clearance
   }
   var rendered = gisportal.templates['map-settings'](data)
   $('.js-map-options').html(rendered);

   $('button.js-edit-layers').on('click', function(e){
      e.preventDefault();
      gisportal.editLayersForm.addSeverTable();
   });

   // enable ddslick'ness
   $('#select-basemap').ddslick({
      onSelected: function(data) { 
         if (data.selectedData) {
            gisportal.selectBaseLayer(data.selectedData.value); 
         }
      }
   });
   $('#select-country-borders').ddslick({
      onSelected: function(data) { 
         if (data.selectedData) {
            gisportal.selectCountryBorderLayer(data.selectedData.value); 
         }
      },
   });
   $('#select-graticules').ddslick({
      onSelected: function(data) { 
         if (data.selectedData) {
            gisportal.setGraticuleVisibility(data.selectedData.value); 
         }
      },
   });
   $('#select-projection').ddslick({
      onSelected: function(data) { 
         if (data.selectedData) {
            gisportal.setProjection(data.selectedData.value); 
         }
      },
   });

   // set the default value for the base map
   if (typeof gisportal.config.defaultBaseMap != 'undefined' && gisportal.config.defaultBaseMap) {
      map.addLayer(gisportal.baseLayers[gisportal.config.defaultBaseMap]);   
      $('#select-basemap').ddslick('select', { value: gisportal.config.defaultBaseMap })
   } else {
      map.addLayer(gisportal.baseLayers.EOX);   
      $('#select-basemap').ddslick('select', { value: "EOX" })
   }

   // set the default value if one exists in config.js
   if (typeof gisportal.config.countryBorder != 'undefined' && typeof gisportal.config.countryBorder.defaultLayer != 'undefined' && gisportal.config.countryBorder.alwaysVisible == true) {
      $('#select-country-borders').ddslick('select', { value: gisportal.config.countryBorder.defaultLayer });
      gisportal.selectCountryBorderLayer(gisportal.config.countryBorder.defaultLayer);
   };

   if (typeof gisportal.config.showGraticules != 'undefined' && gisportal.config.showGraticules) {
      $('#select-graticules').ddslick('select', { value: "On" });
   }

   // WMS URL event handler
   $('button.js-wms-url').on('click', function(e)  {
      e.preventDefault();
      if(!gisportal.wms_submitted){ // Prevents users from loading the same data multiple times (clicking when the data is loading)
         gisportal.wms_submitted = true;
         // Gets the URL and refresh_cache boolean
         gisportal.autoLayer.given_wms_url = $('input.js-wms-url')[0].value;
         gisportal.autoLayer.refresh_cache = $('#refresh-cache-box')[0].checked.toString();

         error_div = $("#wms-url-message");
         // The URL goes through some simple validation before being sent
         if(!(gisportal.autoLayer.given_wms_url.startsWith('http://') || gisportal.autoLayer.given_wms_url.startsWith('https://'))){
            error_div.toggleClass('hidden', false);
            error_div.html("The URL must start with 'http://'' or 'https://'");
            $('#refresh-cache-div').toggleClass('hidden', true);
            gisportal.wms_submitted = false;
         }else{
            // If it passes the error div is hidden and the autoLayer functions are run using the given parameters
            $('input.js-wms-url').val("");
            $('#refresh-cache-message').toggleClass('hidden', true);
            $('#refresh-cache-div').toggleClass('hidden', true);
            error_div.toggleClass('hidden', true);
            gisportal.autoLayer.TriedToAddLayer = false;
            gisportal.autoLayer.loadGivenLayer();
            gisportal.panels.showPanel('choose-indicator');
            gisportal.addLayersForm.layers_list = {};
            gisportal.addLayersForm.server_info = {};
            // The wms_url is stored in the form_info dict so that it can be loaded the next time the page is loaded
            gisportal.addLayersForm.form_info = {"wms_url":gisportal.autoLayer.given_wms_url};
            gisportal.addLayersForm.refreshStorageInfo();
         }
      }
   });

   // WMS URL event handler for refresh cache checkbox
   $('input.js-wms-url').on('change', function(e)  {
      gisportal.wms_submitted = false; // Allows the user to submit the different WMS URL again
      var input_value = $('input.js-wms-url')[0].value
      if(input_value.length > 0){
         var clean_url = gisportal.utils.replace(['http://','https://','/','?'], ['','','-',''], input_value);
         // The timeout is measured to see if the cache can be refreshed. if so the option if shown to the user to do so, if not they are told when the cache was last refreshed.
         $.ajax({
            url:  'cache/' + gisportal.userPermissions.domainName + '/temporary_cache/'+clean_url+".json?_="+ new Date().getMilliseconds(),
            dataType: 'json',
            success: function(layer){
               if(!gisportal.wms_submitted){
                  $('#refresh-cache-message').toggleClass('hidden', false);
                  if(layer.timeStamp){
                     $('#refresh-cache-message').html("This file was last cached: " + new Date(layer.timeStamp));
                  }
                  if(!layer.timeStamp || (+new Date() - +new Date(layer.timeStamp))/60000 > gisportal.config.cacheTimeout){
                     $('#refresh-cache-div').toggleClass('hidden', false);
                  }else{
                     $('#refresh-cache-div').toggleClass('hidden', true);
                  }
               }
            },
            error: function(e){
               $('#refresh-cache-message').toggleClass('hidden', true);
               $('#refresh-cache-div').toggleClass('hidden', true);
            }
         });
      }else{
         $('#refresh-cache-message').toggleClass('hidden', true);
         $('#refresh-cache-div').toggleClass('hidden', true);
      }
   });

};

gisportal.setGraticuleVisibility = function(setTo) {
   gisportal.events.trigger('map-setting.graticules', setTo);
   
   if (setTo == 'On') {
      graticule_control.setMap(map);
   } else {
      try {
         graticule_control.setMap();   
      } catch(e) {
         // setMap doesn't like being called before it's ready, so breaks when page first loads
      }
      
   }
}

/** Create  the country borders overlay
 *
 */
gisportal.createCountryBorderLayers = function() {
   
   gisportal.countryBorderLayers = {
      countries_all_white: new ol.layer.Tile({ 
         id: 'countries_all_white', 
         title: 'White border lines',
         source: new ol.source.TileWMS({
            url: 'https://rsg.pml.ac.uk/geoserver/wms?',
            crossOrigin: null,
            params: { LAYERS: 'rsg:full_10m_borders', VERSION: '1.1.0', STYLES: 'line-white', SRS: gisportal.projection},
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }),
      }),
      countries_all_black: new ol.layer.Tile({ 
         id: 'countries_all_black', 
         title: 'Black border lines',
         source: new ol.source.TileWMS({
            url: 'https://rsg.pml.ac.uk/geoserver/wms?',
            crossOrigin: null,
            params: { LAYERS: 'rsg:full_10m_borders', VERSION: '1.1.0', STYLES: 'line_black', SRS: gisportal.projection},
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }),
      }),
      countries_all_blue: new ol.layer.Tile({ 
         id: 'countries_all_blue', 
         title: 'Blue border lines',
         source: new ol.source.TileWMS({
            url: 'https://rsg.pml.ac.uk/geoserver/wms?',
            crossOrigin: null,
            params: { LAYERS: 'rsg:full_10m_borders', VERSION: '1.1.0', STYLES: 'line', SRS: gisportal.projection},
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }),
      })
   };


}

gisportal.setCountryBordersToTopLayer = function() {
   try { // because it might not exist yet
      gisportal.selectCountryBorderLayer($('#select-country-borders').data().ddslick.selectedData.value);
   } catch(e) {

   }
}

gisportal.selectCountryBorderLayer = function(id) {
   // first remove all other country layers that might be on the map
   for (var prop in gisportal.countryBorderLayers) {
      try {
         map.removeLayer(gisportal.countryBorderLayers[prop])   
      } catch(e) {
         // nowt to do really, the layer may not be on the map
      }
   }
   // then add the selected one, as long as it's not 'None' (0)
   if (id != '0') {
      map.addLayer(gisportal.countryBorderLayers[id]);
   }  
}


/**
 * Create all the base layers for the map.
 */
gisportal.createBaseLayers = function() {

   gisportal.baseLayers = {
      EOX: new ol.layer.Tile({
         id: 'EOX',                       // required to populate the display options drop down list
         title: 'EOX',
         description: 'EPSG:4326 only',
         projections: ['EPSG:4326'],
         source: new ol.source.TileWMS({
            url: 'https://tiles.maps.eox.at/wms/?',
            crossOrigin: null,
            params: {LAYERS : 'terrain-light', VERSION: '1.1.1', SRS: gisportal.projection, wrapDateLine: true },
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }) 
      }),
      GEBCO: new ol.layer.Tile({
         id: 'GEBCO',
         title: 'GEBCO',
         projections: ['EPSG:4326', 'EPSG:3857'],
         source: new ol.source.TileWMS({
            url: 'https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?',
            crossOrigin: null,
            params: {LAYERS: 'gebco_08_grid', VERSION: '1.1.1', SRS: gisportal.projection, FORMAT: 'image/jpeg', wrapDateLine: true },
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }) 
      }),
      MetacartaBasic: new ol.layer.Tile({
         id: 'MetacartaBasic',
         title: 'Metacarta Basic',
         description: 'EPSG:4326 only',
         projections: ['EPSG:4326'],
         source: new ol.source.TileWMS({
            url: 'http://vmap0.tiles.osgeo.org/wms/vmap0?',
            crossOrigin: null,
            params: {LAYERS: 'basic', VERSION: '1.1.1', SRS: gisportal.projection, wrapDateLine: true },
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }) 
      }),
      Landsat: new ol.layer.Tile({
         id: 'Landsat',
         title: 'Landsat',
         projections: ['EPSG:4326', 'EPSG:3857'],
         source: new ol.source.TileWMS({
            url: 'http://irs.gis-lab.info/?',
            crossOrigin: null,
            params: {LAYERS: 'landsat', VERSION: '1.1.1', SRS: gisportal.projection, wrapDateLine: true },
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }) 
      }),
      BlueMarble: new ol.layer.Tile({
         id: 'BlueMarble',
         title: 'Blue Marble',
         projections: ['EPSG:4326', 'EPSG:3857'],
         source: new ol.source.TileWMS({
            url: 'http://demonstrator.vegaspace.com/wmspub/?',
            crossOrigin: null,
            params: {LAYERS: 'BlueMarble', VERSION: '1.1.1', SRS: gisportal.projection, wrapDateLine: true },
            tileLoadFunction: function(tile, src) {
               gisportal.loading.increment();

               var tileElement = tile.getImage();
               tileElement.onload = function() {
                  gisportal.loading.decrement();
               };
               tileElement.src = src;
            }
         }) 
      }),
      OSM: new ol.layer.Tile({
         id: 'OSM',
         title: 'Open Street Map',
         description: 'EPSG:3857 only',
         projections: ['EPSG:3857'],
         source: new ol.source.OSM({
            projection: gisportal.projection
         })
      }),
   }

   if (gisportal.config.bingMapsAPIKey) {
      gisportal.baseLayers.BingMapsAerial = new ol.layer.Tile({
         id: 'BingMapsAerial',
         title: 'Bing Maps - Aerial imagery',
         description: 'EPSG:3857 only',
         projections: ['EPSG:3857'],
         source: new ol.source.BingMaps({
            key: gisportal.config.bingMapsAPIKey,
            imagerySet: 'Aerial'
         })
      });

      gisportal.baseLayers.BingMapsAerialWithLabels = new ol.layer.Tile({
         id: 'BingMapsAerialWithLabels',
         title: 'Bing Maps - Aerial imagery with labels',
         description: 'EPSG:3857 only',
         projections: ['EPSG:3857'],
         source: new ol.source.BingMaps({
            key: gisportal.config.bingMapsAPIKey,
            imagerySet: 'AerialWithLabels'
         })
      });

      gisportal.baseLayers.BingMapsRoad = new ol.layer.Tile({
         id: 'BingMapsRoad',
         title: 'Bing Maps - Road',
         description: 'EPSG:3857 only',
         projections: ['EPSG:3857'],
         source: new ol.source.BingMaps({
            key: gisportal.config.bingMapsAPIKey,
            imagerySet: 'Road'
         })
      });

      gisportal.baseLayers.BingMapsCB = new ol.layer.Tile({
         id: 'BingMapsCB',
         title: 'Collins Bart',
         description: 'EPSG:3857 only, coverage of UK only',
         projections: ['EPSG:3857'],
         source: new ol.source.BingMaps({
            key: gisportal.config.bingMapsAPIKey,
            imagerySet: 'collinsBart'
         }),
         viewSettings: {
            minZoom: 10,
            maxZoom: 13,
            defaultCenter: [53.825564,-2.421976]
         }
      });

      gisportal.baseLayers.BingMapsOS = new ol.layer.Tile({
         id: 'BingMapsOS',
         title: 'Ordnance Survey',
         description: 'EPSG:3857 only, coverage of UK only',
         projections: ['EPSG:3857'],
         source: new ol.source.BingMaps({
            key: gisportal.config.bingMapsAPIKey,
            imagerySet: 'ordnanceSurvey'
         }),
         viewSettings: {
            minZoom: 10,
            maxZoom: 17,
            defaultCenter: [53.825564,-2.421976]
         }
      });

   }
};

gisportal.selectBaseLayer = function(id) {
   gisportal.events.trigger('map-setting.basemap-change', id);

   // take off all the base maps
   for (var prop in gisportal.baseLayers) {
      try {
         map.removeLayer(gisportal.baseLayers[prop])
      } catch(e) {
         // nowt to do really, the base layer may not be on the map
      }
   }
   // check to see if we need to change projection
   var current_projection = map.getView().getProjection().getCode();
   var msg = '';
   var setViewRequired = true;

   // the selected base map isn't available in the current projection
   if (_.indexOf(gisportal.baseLayers[id].getProperties().projections, current_projection) < 0) {
      // if there's only one available projection for the selected base map set the projection to that value and then load the base map
      if (gisportal.baseLayers[id].getProperties().projections.length == 1) {
         msg = 'The projection has been changed to ' + gisportal.baseLayers[id].getProperties().projections[0] + ' in order to display the ' + gisportal.baseLayers[id].getProperties().title + ' base layer';
         gisportal.setProjection(gisportal.baseLayers[id].getProperties().projections[0])
         $('#select-projection').ddslick('select', { value: gisportal.baseLayers[id].getProperties().projections[0], doCallback: false })
         setViewRequired = false;
      } else {
         msg = 'The \'' + gisportal.baseLayers[id].getProperties().title + '\' base map is not available in the current projection. Try changing the projection first and then selecting the base map again';
         return;
      }
   } 

   // if there's a message as a result of reprojection display it
   if (msg.length > 0) {
      $('.js-map-settings-message').html(msg).toggleClass('alert-warning', true).toggleClass('hidden', false);
   } else {
      $('.js-map-settings-message').html('').toggleClass('alert-warning', false).toggleClass('hidden', true);
   }
   // then add the selected option and send it to the bottom
   if (id !== 'none') {
      map.addLayer(gisportal.baseLayers[id]);
   }
   // and make sure that they are in the correct order
   if (gisportal.selectedLayers.length > 0) {
      gisportal.indicatorsPanel.reorderLayers();   
   }

   if (setViewRequired) {
      var centre = map.getView().getCenter();
      var extent = map.getView().calculateExtent(map.getSize());
      var projection = map.getView().getProjection().getCode();
      gisportal.setView(centre, extent, projection);
   }
}

gisportal.createGraticules = function() {

   graticule_control = new ol.Graticule({
      // the style to use for the lines, optional.
      strokeStyle: new ol.style.Stroke({
         color: 'rgba(255,255,255,0.9)',
         width: 1,
         lineDash: [0.5, 4]
      })
   });
   if (gisportal.config.showGraticules) {
      graticule_control.setMap(map);
   }

}
  
gisportal.setProjection = function(new_projection) {
   // first make sure that base layer can accept the projection
   var current_basemap = $('#select-basemap').data('ddslick').selectedData.value;

   // does the current base map allow the requested projection?
   if (_.indexOf(gisportal.baseLayers[current_basemap].getProperties().projections, new_projection) < 0) {
      // no, tell the user then bail out
      $('.js-map-settings-message')
         .html('The \'' + gisportal.baseLayers[current_basemap].getProperties().title + '\' base map cannot be used with '+ new_projection +'. Try changing the base map and then selecting the required projection.')
         .toggleClass('alert-danger', true)
         .toggleClass('hidden', false);
      // set the projection ddslick value back to original value
      $('#select-projection').ddslick('revertToPreviousValue')
      return;
   } else {
      $('.js-map-settings-message').html('').toggleClass('alert-danger', false).toggleClass('hidden', true);
   }
   
   // the centre point so that we know where we are
   var current_centre = map.getView().getCenter();
   // the projection so that we know what we're transforming from
   var current_projection = map.getView().getProjection().getCode();
   // the extent so that we can make sure the visible area remains visible in the new projection
   var current_extent = map.getView().calculateExtent(map.getSize());
   var new_extent = gisportal.reprojectBoundingBox(current_extent, current_projection, new_projection);

   var new_centre = ol.proj.transform(current_centre, current_projection, new_projection);
   gisportal.setView(new_centre, new_extent, new_projection);
   gisportal.refreshLayers();
}

gisportal.setView = function(centre, extent, projection) {
   var current_zoom = map.getView().getZoom();
   var min_zoom = 3;
   var max_zoom = 12;
   if (projection == 'EPSG:3857') max_zoom = 19;

   var viewSettings = gisportal.baseLayers[$('#select-basemap').data('ddslick').selectedData.value].getProperties().viewSettings;
   if (typeof viewSettings !== 'undefined') {
      if (typeof viewSettings.minZoom !== 'undefined') min_zoom = viewSettings.minZoom;
      if (typeof viewSettings.maxZoom !== 'undefined') max_zoom = viewSettings.maxZoom;
   }

   var view = new ol.View({
         projection: projection,
         center: centre,
         minZoom: min_zoom,
         maxZoom: max_zoom,
      })
   map.setView(view);
   map.getView().fit(extent, map.getSize());

}

gisportal.reprojectBoundingBox = function(bounds, from_proj, to_proj) {
   var new_bounds = bounds;

   if (from_proj != to_proj) {
      var new_max_extent = gisportal.availableProjections[to_proj].bounds

      var sw_corner = gisportal.reprojectPoint([bounds[0], bounds[1]], from_proj, to_proj);
      var ne_corner = gisportal.reprojectPoint([bounds[2], bounds[3]], from_proj, to_proj);
      
      var new_bounds = [sw_corner[0], sw_corner[1], ne_corner[0], ne_corner[1]];

      for (var i = 0; i < 4; i++) {
         if (isNaN(new_bounds[i])) new_bounds[i] = new_max_extent[i];
      }   
   }
   return new_bounds;
}

gisportal.reprojectPoint = function(point, from_proj, to_proj) {
   return ol.proj.transform(point, from_proj, to_proj);
}

gisportal.refreshLayers = function() {
   _.forEach(map.getLayers().a, function(layer) {
      var params = null;
      try {
         params = layer.getSource().getParams();   
      } catch(e) {}

      if (params) {
         params.t = new Date().getMilliseconds();
         layer.getSource().updateParams(params);
      }
   });
}