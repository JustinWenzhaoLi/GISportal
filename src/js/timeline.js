/**
 * OPEC.Timeline is an interactive visualisation widget to visualise date-time ranges
 * with a start and end date and detail dates in between as timelines on a chart based around
 * d3.js (http://d3js.org/), a JavaScript library for manipulating documents based on data.
 *
 * OPEC.Timeline has been tested on Firefox 18.0, Safari 5.1.2, Chrome 24.0, Opera 11.64 & IE 9+.
 *
 * @author  Martyn J Atkins, <martat@pml.ac.uk>
 *          Shane Hudson, <shh@pml.ac.uk>
 * @date    2013-02-28
 * @version 1.0
 *
 * @note OPEC.Timeline options format
 *  {
 *     "__comment": {String},                                                                          A comment for the JSON data file (ignored)
 *     "selectedDate": {String},                                                                       Initial selected date (ISO8601 datetime string)
 *     "chartMargins": { "top": {number}, "right": {number}, "bottom": {number}, "left": {number} },   Widget chart margins (pixels)
 *     "barHeight": {number},                                                                          Height/thickness of the time bars (pixels)
 *     "barMargin": {number},                                                                          Margin spacing around time bars (pixels)
 *     "timebars": [
 *        {
 *           "name": {String},                                                                         Time bar: unique name
 *           "label": {String},                                                                        Time bar: label to show on bar
 *           "startDate": {String},                                                                    Time bar: start date for data range (ISO8601 datetime string)
 *           "endDate": {String},                                                                      Time bar: end date for data range (ISO8601 datetime string)
 *           "dateTimes": {String}[]                                                                   Time bar: comma separated array of ISO8601 datetime strings detailing available data
 *        },
 *        timebar {Object},                                                                            Further time bar objects in the array
 *        timebar {Object}                                                                             Further time bar objects in the array
 *     ]
 *  }
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at:
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 * Copyright (c) 2013 PML Applications Ltd
 *
 */

/**
 * The TimeLine is a visualisation chart to visualise events in time. 
 *
 * @constructor TimeLine
 *
 * @param {string}   id       The DOM element id in which the timeline will be created.
 * @param {Object}   options  Timeline options in JSON format
 */
gisportal.TimeLine = function(id, options) {
   
   // Use "self" to refer to this instance of the TimeLine object
   var self = this;

    $('.js-current-date').pikaday({
      format: "YYYY-MM-DD",
      onSelect: function(){
         self.setDate( this.getDate() );
      }
    });
   
   //--------------------------------------------------------------------------
   
   // Default options
   var defaults = {
      comment: "Sample timeline data",
      selectedDate: new Date(),
      chartMargins: {
         top: 0,
         right: 0,
         bottom: 0,
         left: 0
      },
      barHeight: 5,
      barMargin: 4,
      timebars: []
   };
   
   this.options = $.extend({}, defaults, options) ;

   this.hiddenRangebars = []; // Used to hide range bars

   // Initialise the fixed TimeLine widget properties from the JSON options file
   this.id = id;
   this.visible = true;
   this.now = new Date();
   
   // To lazy to go and rename everything "this.options.xxx"
   this.timebars = this.options.timebars;
   this.layerbars = this.timebars.filter(function(element, index, array) { return element.type == 'layer'; });
   
   this.barHeight = this.options.barHeight;
   this.barMargin = this.options.barMargin;
   
   this.selectedDate = this.options.selectedDate;
   this.margin = this.options.chartMargins;
   this.laneHeight = this.barHeight + this.barMargin * 2 + 1;
   this.colours = d3.scale.category10(); // d3 colour categories scale with 10 contrasting colours
   
   //--------------------------------------------------------------------------

   // Set up initial dynamic dimensions
   this.reHeight();
   this.reWidth();
   //--------------------------------------------------------------------------
   
   // Set initial x scale
   this.minDate = d3.min(this.timebars, function(d) { return new Date(d.startDate); });
   this.maxDate = d3.max(this.timebars, function(d) { return new Date(d.endDate); });
   
   // Set some default max and min dates if no initial timebars (6 months either side of selected date)
   if (typeof this.minDate === 'undefined' || this.minDate === null ) {
      this.minDate = new Date(this.selectedDate.getTime() - 15778450000);}
   if (typeof this.maxDate === 'undefined' || this.maxDate === null ) {
      this.maxDate = new Date(this.selectedDate.getTime() + 15778450000);
   }
   
   // Set initial y scale
   this.xScale = d3.time.scale().domain([this.minDate, this.maxDate]).range([0, this.width]);
   this.yScale = d3.scale.linear().domain([0, this.timebars.length]).range([0, this.height]); 
   
   //--------------------------------------------------------------------------
   
   // Used to stop both events firing.
   var isDragging = false;
   
   this.clickDate = function(d, i) {
      // Stop the event firing if the drag event is fired.
      if(isDragging) {
         //isDragging = false;
         return;
      }
      
      var x = d3.mouse(this)[0];
      
      // Prevent dragging the selector off-scale
      x = (x > self.xScale.range()[0] && x < self.xScale.range()[1]) ? x : (x - d3.event.layerX);
      
      // Now update the date based on the new value of x
      self.draggedDate = self.xScale.invert(x);
      
      // Move the graphical marker
      
      self.setDate(self.draggedDate);
   };
  

   // Set up the SVG chart area within the specified div; handle mouse zooming with a callback.
   this.zoom = d3.behavior.zoom()
               .x(this.xScale)
               .on('zoom', function() {
                  isDragging = true; self.redraw();
               });
                 

   // Append the svg and add a class before attaching both events.
   this.chart = d3.select('div#' + this.id)
      .append('svg')
      .attr('class', 'timeline')
      .call(self.zoom)
      .on('click', self.clickDate)
      .on('mousedown', function() {  isDragging = false; });


   //--------------------------------------------------------------------------
      
   // Create the graphical drawing area for the widget (main)
   this.main = this.chart.append('svg:g')
      .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')')
      .attr('class', 'main');

   // Separator line drawing initialisation
   this.separatorArea = this.main.append('svg:g');

   // Initialise the area to hold the range bars as horizontal timelines
   this.barArea = this.main.append('svg:g');

   // Initialise the fine-grained date-time detail bar area
   this.dateDetailArea = this.main.append('svg:g');   
   

   // Initialise the fine-grained date-time detail bar area
   this.rangeBarArea = this.main.append('svg:g');   
   
   // Initialise a vertical line through all timelines for today's date
   this.nowLine = this.main.append('svg:line').attr('class', 'nowLine');

   // Set up callback functions to handle dragging of a selected date-time marker
   this.draggedDate = this.selectedDate;
   
   //--------------------------------------------------------------------------
   
   /**
    * Private method/function which handles the drag event of the selected date marker
    */
   this.dragDate = function() {
      var self = gisportal.timeline;
      var x = self.xScale(self.draggedDate) + d3.event.dx;
      
      // Prevent dragging the selector off-scale
      x = (x > self.xScale.range()[0] && x < self.xScale.range()[1]) ? x : (x - d3.event.dx);
      
      // Now update the date based on the new value of x
      self.draggedDate = self.xScale.invert(x);
      
      // Move the graphical marker
      self.selectedDateLine.attr('x', function(d) { return d3.round(self.xScale(self.draggedDate) - 1.5); });
      $('.js-current-date').val(moment(self.draggedDate).format('YYYY-MM-DD'));
   };
   
   this.dragDateEnd = function() {
      self.setDate(self.draggedDate);
   };

   // Initialise the selected date-time marker and handle dragging via a callback
   this.selectedDateLine = this.main.append('svg:rect').attr('cursor', 'e-resize').attr('class', 'selectedDateLine')
      .call(
         d3.behavior.drag().origin(Object)
         .on('drag', self.dragDate)
         .on('dragend', self.dragDateEnd)    
      ).on("mousedown", function() { d3.event.stopPropagation(); });

   // X-axis intialisation
   this.xAxis = d3.svg.axis().scale(this.xScale).orient('bottom').tickSize(6, 0, 0);
   this.main.append('svg:g').attr('transform', 'translate(0,' + d3.round(this.height + 0.5) + ')').attr('class', 'axis');

   // Initialise the time bar label area to the left of the timeline
   this.labelArea = this.main.append('svg:g');

   // Draw the graphical elements
   self.redraw();

   // Handle browser window resize event to dynamically scale the timeline chart along the x-axis
   $(window).resize(function(event) {
      // Change the widget width settings dynamically if the DIV is visible
      if(self.visible && event.target == window){ self.reWidth(); self.redraw(); }
   });
};

// Handle browser window resize event to dynamically scale the timeline chart along the x-axis
gisportal.TimeLine.prototype.redraw = function() {
   
   var self = this;  // Useful for when the scope/meaning of "this" changes
   
   // Recalculate the x and y scales before redraw
   // 
   this.reWidth();
    this.xScale.range([0, this.width ]);
   //this.xScale.domain([self.minDate, self.maxDate]).range([0, this.width]);
   this.yScale.domain([0, this.timebars.length]).range([0, this.height]);
   // Scale the chart and main drawing areas
   $('#' + this.id).height(this.chartHeight);
   this.main.attr('width', this.width).attr('height', this.height);
   this.chart.attr('width', this.chartWidth).attr('height', this.chartHeight)
      // Set the SVG clipping area to prevent drawing outside the bounds of the widget chart area
      .style('clip', 'rect( 0px, '+ (this.width + this.margin.left) +'px, ' + this.chartHeight + 'px, ' + this.margin.left + 'px)');

   // Scale the x-axis and define the x-scale label format
   this.main.selectAll('.axis').attr('transform', 'translate(0,' + d3.round(this.height + 0.5) + ')').call(this.xAxis);
   // Generate a dynamic x-axis scale dependent on dimensions
   
   var scaling = (self.xScale.domain()[1] - self.xScale.domain()[0]) / (this.width * 4e7);
   if (scaling > 12) {
      this.xAxis.ticks(d3.time.years, d3.round(scaling/12)).tickFormat(d3.time.format('%Y'));
   }
   else if (scaling <= 12 && scaling > 1) {
      this.xAxis.ticks(d3.time.months, getNearestInArray([1, 2, 3, 4, 6, 12], scaling)).tickFormat(d3.time.format('%b %y'));
   }
   else if (scaling <= 1 && scaling > 1/7) {
      this.xAxis.ticks(d3.time.weeks, d3.round(scaling*4.3)).tickFormat(d3.time.format('%d/%m/%y'));
   }
   else if (scaling <= 1/7 && scaling > 1/365) {
      this.xAxis.ticks(d3.time.days, d3.round(scaling*30)).tickFormat(d3.time.format('%d/%m/%y'));
   }
   else if (scaling <= 1/365) {
      this.xAxis.ticks(d3.time.hours, d3.round(scaling*730)).tickFormat(d3.time.format('%I %p'));
   }

   //--------------------------------------------------------------------------
   // Draw the time bars
   // Note: Had to use closures to move variables from each into the .attr etc.
   
   this.bars = this.barArea.selectAll('rect').data(this.timebars);
   this.bars
      .enter().append('svg:rect')
      .each(function(d, i) {
         d.colour = d.colour || self.colours(i);
         if(d.type == 'layer')  {
            d3.select(this).attr('y', (function(d, i) { return d3.round(self.yScale(i) + self.barMargin + 0.5); })(d,i))
            .transition().duration(500)
            .attr('height', d3.round(self.barHeight + 0.5))
            .attr('stroke', (function(d, i) { return d.colour || self.colours(i); })(d,i))
            .attr('class', 'timeRange');
         }
      });
      
   // Time bar removal
   this.bars.exit().remove();
   // Re-scale the x values and widths of ALL the time bars
   this.bars
      .attr('x', function(d) { 
         if(d.startDate) { 
            var x = d3.round(self.xScale(new Date(d.startDate)) + 0.5); 
            return x; 
         } else { 
            return 0;
         } 
      }).attr('width', function(d) { 
         if(d.endDate) { 
            return d3.round(self.xScale(new Date(d.endDate)) - self.xScale(new Date(d.startDate))); 
         } else { 
            return 0; 
         } 
      });
   
      
   //--------------------------------------------------------------------------
   
   function updateLines(d1, i1) {
         if(d1.type == 'layer')  {
            // Time Bar
            var takenSpaces = {};
            var dateTimes = d1.dateTimes.filter(function( dateStr ){
               var x = d3.round(self.xScale(new Date(dateStr)) + 0.5);
               if( takenSpaces[x] === true )
                  return false;
               takenSpaces[x] = true;
               return (0 < x && x < self.width);
            });

            var g = d3.select(this).selectAll('line').data(dateTimes, function(d) { return(d); });  // <-- second level data-join
             g.enter().append('svg:line')
               .attr('y1', function() { return d3.round(self.yScale(i1) + self.barMargin + 1.5); })
               .attr('y2', function() { return d3.round(self.yScale(i1) + self.laneHeight - self.barMargin + 0.5); })
               .attr('class', 'detailLine stroke');
            g.exit()
              .remove();
         }
      }
   // Position the date time detail lines (if available) for each time bar
   this.dateDetails = this.dateDetailArea.selectAll('g').data(this.timebars);

   // Add new required g elements
   this.dateDetails.enter().append('svg:g');
   
   // Remove unneeded g elements
   this.dateDetails.exit().remove(); 

   // Update all elements!
   this.dateDetailArea.selectAll('g').attr('d', updateLines);
   
   // Re-scale the x values for all the detail lines for each time bar
   this.main.selectAll('.detailLine')
      .attr('x1', function(d) { return d3.round(self.xScale(new Date(d)) + 0.5); })
      .attr('x2', function(d) { return d3.round(self.xScale(new Date(d)) + 0.5); });
      
   // Draw the current date-time line
   this.nowLine
      .attr('x1', d3.round(this.xScale(self.now) + 0.5)).attr('y1', 0)
      .attr('x2', d3.round(this.xScale(self.now) + 0.5)).attr('y2', self.height);

   // Draw the selected date-time line
   this.selectedDateLine
      .attr('x', function(d) { return d3.round(self.xScale(self.selectedDate) - 1.5); }).attr('y', 2)
      .attr('width', 10).attr('height', self.height - 2)
      .attr('rx', 6).attr('ry', 6);
  
   this.drawLabels();

   if(self.getDate() < moment(self.minDate).startOf('day').toDate()){
      self.setDate(self.minDate);
   }
   if(self.getDate() > moment(self.maxDate).startOf('day').toDate()){
      self.setDate(self.maxDate);
   }
};

// Re-calculate the dynamic widget height
gisportal.TimeLine.prototype.reHeight = function() {
   this.height = this.laneHeight*(this.timebars.length);
   // If no timebars, we'll need a default height, say 25 pixels
   if (this.height === 0){ this.height = 25; }
   this.chartHeight = this.height + this.margin.top + this.margin.bottom + 20; // +20 pixels to accomodate the x-axis labels
};

// Re-calculate the dynamic widget width
gisportal.TimeLine.prototype.reWidth = function() {
   this.chartWidth = $('div#' + this.id).width();
   this.width = (this.chartWidth - this.margin.right - this.margin.left) ;
};

// Reset the timeline to its original data extents
gisportal.TimeLine.prototype.reset = function() {
   this.zoom.translate([0, 0]).scale(1);
   this.reHeight();
   this.reWidth();
   this.redraw();
   this.updatePickerBounds();
};

gisportal.TimeLine.prototype.drawLabels = function()  {

   
   // Draw the time bar labels
   $('.js-timeline-labels').html('');
   for (var i = 0; i < this.timebars.length; i++)  {
      // Update label
      var positionTop = (i+1) * (this.barHeight + this.barMargin);
      positionTop += (i+1) * 3;
      var id = this.timebars[i].id;

      var label = $('.indicator-header[data-id="' + id +'"] > p').html();
      if (!label || label === "") label =  this.timebars[i].label;
      if(gisportal.layers[id] && gisportal.layers[id].tags.region)  label += ' - ' + gisportal.layers[id].tags.region; 
      
      $('.js-timeline-labels').append('<li data-id="' + id +'" style="top: ' + positionTop + 'px">' + label + '</li>');
   }
};

// Zoom function to a new date range
gisportal.TimeLine.prototype.zoomDate = function(startDate, endDate){
   var minDate = new Date(startDate);
   var maxDate = new Date(endDate);
   var padding = (maxDate - minDate) * 0.05; 
   this.minDate = ((minDate instanceof Date) ? new Date(minDate.getTime() - padding) : this.minDate);
   this.maxDate = ((maxDate instanceof Date) ? new Date(maxDate.getTime() + padding) : this.maxDate);
   this.xScale.domain([this.minDate * 0.9, this.maxDate * 1.1]).range([0, this.width]);
   this.zoom.x(this.xScale); // This is absolutely required to programatically zoom and retrigger internals of zoom
   this.redraw();

   var params = {
      "event" : "date.zoom",
      "startDate" : startDate,
      "endDate": endDate
   };
   gisportal.events.trigger('date.zoom', params);
};

// Add a new time bar using detailed parameters
gisportal.TimeLine.prototype.addTimeBar = function(name, id, label, startDate, endDate, dateTimes) {
   var newTimebar = {};
   newTimebar.name = name;
   newTimebar.id = id;
   newTimebar.label = label;
   newTimebar.startDate = startDate;
   newTimebar.endDate = endDate;
   newTimebar.dateTimes = dateTimes;
   newTimebar.type = 'layer';  
   newTimebar.hidden = false;
   newTimebar.colour = '';
   
   this.timebars.push(newTimebar);
   this.layerbars.push(newTimebar); 

   // TODO: Move asap. tidy up
   if (gisportal.selectedLayers.length === 1 && (!gisportal.cache.state || !gisportal.cache.state.timeline))  {
      this.reHeight();
      // redraw is done in zoom
      var data = gisportal.timeline.layerbars[0];
      gisportal.timeline.zoomDate(data.startDate, data.endDate);

      if(!moment(gisportal.timeline.getDate()).isBetween(moment(startDate), moment(endDate))){
         gisportal.timeline.setDate(endDate);
      }
   }  
   
   this.reHeight();
   this.redraw(); 
   this.updatePickerBounds();

   // ensure that the timeline is visible and adjust the panel heights accordingly
   $('.timeline-container').css('bottom','0px');
   var h = $('.timeline-container').height() + 10; // +10 for the padding
   $('.panel').css('bottom', h + 35 +'px');
   $('.ol-attribution').css('bottom', h +'px');
   var collab_panel = $('.collaboration-panel');
   var collab_hidden = collab_panel.hasClass('hidden');
   var top = collab_panel.toggleClass('hidden', false).position().top;
   collab_panel.toggleClass('hidden', collab_hidden);
   collab_panel.css('max-height', "calc(100% - "+ (h + top + 35) +'px)');
   
};


gisportal.TimeLine.prototype.has = function(name)  {
   var has = _.filter(gisportal.timeline.timebars, function(d)  {
      return d.name.toLowerCase() === name.toLowerCase();
   });

   if (has.length > 0) return true;
   return false;
};

gisportal.TimeLine.prototype.removeTimeBarById = function(id)  {
   if (this.has(id))  {
      this.removeTimeBarByName(id);
   }
   else if (gisportal.layers[id]) {
      var name = gisportal.layers[id].name;
      if (this.has(name))  {
         this.removeTimeBarByName(name); 
      }
   }
};

// Remove a time bar by name (if found)
gisportal.TimeLine.prototype.removeTimeBarByName = function(name) {
   var self = this,
   type = "";
   
   function removeByName(anArray) {
      for (var j = 0; j < anArray.length; j++){
         if (anArray[j].name.toLowerCase() == name.toLowerCase()) {
            var bar = anArray[j];
            anArray.splice(j, 1);
            return bar;
         }
      }
   }
   
   var bar = removeByName(self.timebars);
   type = bar.type;
   
   if(type == 'layer') { removeByName(self.layerbars); }
   
   var temp = this.timebars;
   // Kludge to clear out the display
   this.timebars = [];
   this.reHeight();
   this.redraw();
   // Now re-instate the newly altered array and redraw
   this.timebars = temp;
   this.reHeight();
   this.redraw();
   this.updatePickerBounds();

   var h = $('.timeline-container').height() + 10; // +10 for the padding
   if(gisportal.timeline.timebars.length <= 0){
      gisportal.timeline = null;
      $('#timeline').html("");
      gisportal.nonLayerDependent();
      $('.timeline-container').css('bottom','-1000px');
      h = 0;
   }
   $('.panel').css('bottom', h + 35 +'px');
   $('.ol-attribution').css('bottom', h +'px');
   var collab_panel = $('.collaboration-panel');
   var collab_hidden = collab_panel.hasClass('hidden');
   var top = collab_panel.toggleClass('hidden', false).position().top;
   collab_panel.toggleClass('hidden', collab_hidden);
   collab_panel.css('max-height', "calc(100% - "+ (h + top + 35) +'px)');
};

// Set the currently selected date and animated the transition
gisportal.TimeLine.prototype.setDate = function(date) {
   if(gisportal.timeline.getDate().toDateString() == date.toDateString()){
      return false;
   }
   gisportal.hideAllPopups();
   var self = this;  // Useful for when the scope/meaning of "this" changes
   this.selectedDate = self.draggedDate = new Date(date);
   // Move the selected date-time line
   // ADD_CONFIG: Animation may not be wanted
   this.selectedDateLine.transition().duration(500).attr('x', function(d) { return d3.round(self.xScale(self.selectedDate) - 1.5); });
   
   
   //self.selectedDateLine.attr('x', function(d) { return d3.round(self.xScale(self.draggedDate) - 1.5); });

   gisportal.filterLayersByDate(date);
   self.showDate(date);
   gisportal.timeline.redraw();
   var params = {
      "event" : "date.selected",
      "date" : date
   };
   gisportal.events.trigger('date.selected', params);
};

gisportal.TimeLine.prototype.showDate = function(date) {
   var current = $('.js-current-date').data('date');
   if( !current || new Date(date).getTime() != current.getTime() )
      $('.js-current-date').data('date', date).pikaday( 'setDate', date );
};

// Get the currently selected date 
gisportal.TimeLine.prototype.getDate = function() {
   var selectedDate = new Date(this.selectedDate);
   return ((selectedDate instanceof Date) ? selectedDate : null);
};



// Get the currently selected date 
gisportal.TimeLine.prototype.updatePickerBounds = function() {
   var dates = this.timebars.map(function( bar ){
      return [
         bar.startDate,
         bar.endDate,
      ];
   }).reduce(function(d1,d2){ return d1.concat(d2);},[]);

   var extent = d3.extent( dates );

   $('.js-current-date')
      .pikaday( 'setMinDate', extent[0] )
      .pikaday( 'setMaxDate', extent[1] );

};
