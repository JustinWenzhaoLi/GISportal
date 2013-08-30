from flask import Blueprint, abort, request, jsonify, g, current_app
from opecflask.core.param import Param

import urllib
import urllib2
import tempfile
import numpy as np
import netCDF4 as netCDF
 

portal_wcs = Blueprint('portal_wcs', __name__)

"""
Gets wcs data from a specified server, then performs a requested function
on the received data, before jsonifying the output and returning it.
"""
@portal_wcs.route('/wcs', methods = ['GET'])
def getWcsData():
   import random
   
   g.graphError = "";

   params = getParams() # Gets any parameters
   params = checkParams(params) # Checks what parameters where entered
   
   params['url'] = createURL(params)
   current_app.logger.debug('Processing request...') # DEBUG
   
   type = params['type'].value
   if type == 'histogram': # Outputs data needed to create a histogram
      output = getBboxData(params, histogram)
   elif type == 'timeseries': # Outputs a set of standard statistics
      output = getBboxData(params, basic)
   elif type == 'scatter': # Outputs a scatter graph
      output = getBboxData(params, scatter)
   elif type == 'hovmollerLon' or 'hovmollerLat': # outputs a hovmoller graph
      output = getBboxData(params, hovmoller)
   elif type == 'point':
      output = getPointData(params, raw)
   elif type == 'raw': # Outputs the raw values
      output = getBboxData(params, raw)
   elif type == 'test': # Used to test new code
      output = getBboxData(params, test)
   elif type == 'error': # Used to test error handling client-side
      choice = random.randrange(1,7)
      if choice == 1:
         g.error = "test 404"
         abort(400)
      elif choice == 2:
         abort(401)
      elif choice == 3:
         abort(404)
      elif choice == 4:
         return jsonify(outpu = "edfwefwrfewf")
      elif choice == 5:
         abort(502)
      elif choice == 6:
         x = y # Should create a 500 from apache
   else:
      g.error = '"%s" is not a valid option' % type
      return abort(400)
   
   current_app.logger.debug('Jsonifying response...') # DEBUG
   
   try:
      jsonData = jsonify(output = output, type = params['type'].value, coverage = params['coverage'].value, error = g.graphError)
   except TypeError as e:
      g.error = "Request aborted, exception encountered: %s" % e
      abort(400) # If we fail to jsonify the data return 500
      
   current_app.logger.debug('Request complete, Sending results') # DEBUG
   
   return jsonData

"""
Gets any parameters.
"""
def getParams():
   # Required for url
   nameToParam = {}
   nameToParam["baseURL"] = Param("baseURL", False, False, request.args.get('baseurl'))
   nameToParam["service"] = Param("service", False, True, 'WCS')
   nameToParam["request"] = Param("request", False, True, 'GetCoverage')
   nameToParam["version"] = Param("version", False, True, request.args.get('version', '1.0.0'))
   nameToParam["format"] = Param("format", False, True, request.args.get('format', 'NetCDF3'))
   nameToParam["coverage"] = Param("coverage", False, True, request.args.get('coverage'))
   nameToParam["crs"] = Param("crs", False, True, 'OGC:CRS84')
   
   # Optional extras
   nameToParam["time"] = Param("time", True, True, request.args.get('time', None))
   nameToParam["depth"] = Param("depth", True, False, request.args.get('depth', None))
   
   # One Required
   nameToParam["bbox"] = Param("bbox", True, True, request.args.get('bbox', None))
   nameToParam["circle"] = Param("circle", True, True, request.args.get('circle', None))
   nameToParam["polygon"] = Param("polygon", True, True, request.args.get('polygon', None))
   nameToParam["point"] = Param("point", True, True, request.args.get('point', None))
   
   # Custom
   nameToParam["type"] = Param("type", False, False, request.args.get('type'))
   nameToParam["graphXAxis"] = Param("graphXAxis", True, False, request.args.get('graphXAxis'))
   nameToParam["graphYAxis"] = Param("graphYAxis", True, False, request.args.get('graphYAxis'))
   nameToParam["graphZAxis"] = Param("graphZAxis", True, False, request.args.get('graphZAxis'))
   
   nameToParam["graphXFunc"] = Param("graphXFunc", True, False, request.args.get('graphXFunc'))
   nameToParam["graphYFunc"] = Param("graphYFunc", True, False, request.args.get('graphYFunc'))
   nameToParam["graphZFunc"] = Param("graphZFunc", True, False, request.args.get('graphZFunc'))
   
   return nameToParam

"""
Check the parameters to see if they are valid.
"""
def checkParams(params):    
   checkedParams = {}
   
   for key in params.iterkeys():
      if params[key].value == None or len(params[key].value) == 0:
         if not params[key].isOptional():            
            g.error = 'required parameter "%s" is missing or is set to an invalid value' % key
            abort(400)
      else:
         checkedParams[key] = params[key]
         
   return checkedParams

def createMask(params):
   if params["bbox"] != None:
      pass
   
   

"""
Create the url that will be used to contact the wcs server.
"""
def createURL(params):
   urlParams = {}
   for param in params.itervalues():
      if param.neededInUrl():
         urlParams[param.getName()] = param.value
   
   query = urllib.urlencode(urlParams)
   url = params['baseURL'].value + query
   current_app.logger.debug('URL: ' + url) # DEBUG
   if "wcs2json/wcs" in params['baseURL'].value:
      g.error = 'possible infinite recursion detected, cancelled request'
      abort(400)
   return Param("url", False, False, url)
      
def contactWCSServer(url):
   current_app.logger.debug('Contacting WCS Server with request...')
   resp = urllib2.urlopen(url)     
   current_app.logger.debug('Request successful')
   return resp
      
def saveOutTempFile(resp):
   current_app.logger.debug('Saving out temporary file...')
   temp = tempfile.NamedTemporaryFile('w+b', delete=False)
   temp.write(resp.read())
   temp.close()
   resp.close()
   current_app.logger.debug('Temporary file saved successfully')
   return temp.name
    
def openNetCDFFile(fileName, params):
   current_app.logger.debug('Opening netCDF file...')
   rootgrp = netCDF.Dataset(fileName, 'r', format=params['format'].value)
   current_app.logger.debug('NetCDF file opened')
   return rootgrp

def expandBbox(params):
   # TODO: try except for malformed bbox
   current_app.logger.debug('Expanding Bbox...')
   increment = 0.1
   values = params['bbox'].value.split(',')
   for i,v in enumerate(values):
      values[i] = float(values[i]) # Cast string to float
      if i == 0 or i == 1:
         values[i] -= increment
      elif i == 2 or i == 3:
         values[i] += increment
      values[i] = str(values[i])
   params['bbox'].value = ','.join(values)
   current_app.logger.debug(','.join(values))
   current_app.logger.debug('New Bbox %s' % params['bbox'].value)
   current_app.logger.debug('Bbox Expanded')
   # Recreate the url
   current_app.logger.debug('Recreating the url...')
   params['url'] = createURL(params)
   current_app.logger.debug('Url recreated')
   return params

"""
Generic method for getting data from a wcs server
"""
def getData(params, method, checkdata=None):
   import os
   resp = contactWCSServer(params['url'].value)
   fileName = saveOutTempFile(resp)
   rootgrp = openNetCDFFile(fileName, params)
   current_app.logger.debug('Checking data...')
   # Check data
   # Run passed in method
   current_app.logger.debug('Data checked, beginning requested process...')
   output = method(rootgrp, params)
   rootgrp.close()
   os.remove(fileName)
   current_app.logger.debug('Process complete, returning data for transmission...')
   return output

"""
Tries to get a single point of data to return
"""      
def getPointData(params, method):
   import os
   current_app.logger.debug('Beginning try to get point data...')
   for x in range(10) :
      current_app.logger.debug('Attempt %s' % (x + 1))
      #expand box
      params = expandBbox(params)
      try:
         return getData(params, method)
      except urllib2.URLError as e:
         if hasattr(e, 'code'): # check for the code attribute from urllib2.urlopen
            current_app.logger.debug(e.code)
            if e.code != 400:
               g.graphError = "Failed to make a valid connection with the WCS server"
               return {}
            else:
               current_app.logger.debug('Made a bad request to the WCS server')
   
   # If we get here, then no point found
   g.graphError = "Could not retrieve a data point for that area"
   return {}

def getBboxData(params, method):
   import os, errno
   try:
      return getData(params, method)
   except urllib2.URLError as e:
      if hasattr(e, 'code'): # check for the code attribute from urllib2.urlopen
         if e.code == 400:
            g.error = "Failed to access url, make sure you have entered the correct parameters."
         if e.code == 500:
            g.error = "Sorry, looks like one of the servers you requested data from is having trouble at the moment. It returned a 500."
         abort(400)
         
      g.error = "Failed to access url, make sure you have entered the correct parameters"
      abort(400) # return 400 if we can't get an exact code
   #except IOError as e:
      #if e[0] == 2:
         #g.error = "Unable to save file"
         #abort(400)
           
"""
Performs a basic set of statistical functions on the provided data.
"""
def basic(dataset, params):
   arr = np.array(dataset.variables[params['coverage'].value])
   # Create a masked array ignoring nan's
   maskedArray = np.ma.masked_array(arr, [np.isnan(x) for x in arr])
   time = getCoordinateVariable(dataset, 'Time')
      
   if time == None:
      g.graphError = "could not find time dimension"
      return
   
   times = np.array(time)
   output = {}
   
   units = getUnits(dataset.variables[params['coverage'].value])
   output['units'] = units
   
   current_app.logger.debug('starting basic calc') # DEBUG
   
   #mean = getMean(maskedArray)
   #median = getMedian(maskedArray)
   #std = getStd(maskedArray)
   #min = getMin(maskedArray)
   #max = getMax(maskedArray)
   timeUnits = getUnits(time)
   start = None
   if timeUnits:
      start = (netCDF.num2date(times[0], time.units, calendar='standard')).isoformat()
   else: 
      start = ''.join(times[0])
   
   #=========================================================================
   # if np.isnan(max) or np.isnan(min) or np.isnan(std) or np.isnan(mean) or np.isnan(median):
   #   output = {}
   #   g.graphError = "no valid data available to use"
   # else:
   #   output['global'] = {'mean': mean, 'median': median,'std': std, 'min': min, 'max': max, 'time': start}
   #=========================================================================
   
   output['global'] = {'time': start}
   current_app.logger.debug('starting iter of dates') # DEBUG
   
   output['data'] = {}
   
   for i, row in enumerate(maskedArray):
      #current_app.logger.debug(row)
      if timeUnits:
         date = netCDF.num2date(time[i], time.units, calendar='standard').isoformat()
      else:     
         date = ''.join(times[i])
      mean = getMean(row)
      median = getMedian(row)
      std = getStd(row)
      min = getMin(row)
      max = getMax(row)
      
      if np.isnan(max) or np.isnan(min) or np.isnan(std) or np.isnan(mean) or np.isnan(median):
         pass
      else:
         output['data'][date] = {'mean': mean, 'median': median,'std': std, 'min': min, 'max': max}
   
   if len(output['data']) < 1:
      g.graphError = "no valid data available to use"
      return output
      
   current_app.logger.debug('Finished basic') # DEBUG
   
   return output

def hovmoller(dataset, params):
   xAxisVar = params['graphXAxis'].value
   yAxisVar = params['graphYAxis'].value
   zAxisVar = params['graphZAxis'].value
   
   #np.set_printoptions(threshold=np.nan)
   #print xAxisVar, yAxisVar, zAxisVar
       
   xVar = getCoordinateVariable(dataset, xAxisVar)
   xArr = np.array(xVar)
   yVar = getCoordinateVariable(dataset, yAxisVar)
   yArr = np.array(yVar)
   zArr = np.array(dataset.variables[zAxisVar])
   
   if xVar == None:
      g.graphError = "could not find %s dimension" % xAxisVar
      return
   if yVar == None:
      g.graphError = "could not find %s dimension" % yAxisVar
      return
   
   # Create a masked array ignoring nan's
   zMaskedArray = np.ma.masked_array(zArr, [np.isnan(x) for x in zArr])
      
   time = None
   lat = None
   lon = None
   
   if xAxisVar == 'Time':
      times = xArr
      time = xVar
      lat = yArr
   else:        
      lon = xArr
      times = yArr
      time = yVar
      
   #for debug
   #if lat == None:
      #var = getCoordinateVariable(dataset, 'Lat')
      #lat = np.array(var)
   #elif lon == None:
      #var = getCoordinateVariable(dataset, 'Lon')
      #lon = np.array(var)
   

   output = {}
   
   numDimensions = len(zMaskedArray.shape)
   
   # If 4 dimensions, assume depth and switch with time
   if numDimensions == 4:
      depth = np.array(getDepth(dataset))
      zMaskedArray.swapaxes(1, 0)
      if 'depth' in params:         
         if params['depth'].value in depth:
            pass
      else:
         zMaskedArray = zMaskedArray[0]
         output['depth'] = float(depth[0])
   
   units = getUnits(dataset.variables[params['coverage'].value])
   output['units'] = units
   
   current_app.logger.debug('starting basic calc') # DEBUG
   
   #mean = getMean(maskedArray)
   #median = getMedian(maskedArray)
   #std = getStd(maskedArray)
   #min = getMin(maskedArray)
   #max = getMax(maskedArray)
   
   timeUnits = getUnits(time)
   start = None
   if timeUnits:
      start = (netCDF.num2date(times[0], time.units, calendar='standard')).isoformat()
   else: 
      start = ''.join(times[0])
   
   output['global'] = {'time': start}
   current_app.logger.debug('starting iter of dates') # DEBUG
   
   output['data'] = []
   
   # Temp code dup
   if lat != None:     
      for i, timelatlon in enumerate(zMaskedArray):
         
         date = None    
         if timeUnits:
            date = netCDF.num2date(time[i], time.units, calendar='standard').isoformat()
         else:     
            date = ''.join(times[i])
         #output['data'][date.isoformat()] = []
         
         #print timelatlon
         
         for j, latRow in enumerate(timelatlon):   
            #print '-------------------------------------'
            #print latRow         
            latitude = lat[j]
            #output['data'][date.isoformat()].append([float(latitude), getMean(latRow)])              
            mean = getMean(latRow)
            
            if np.isnan(mean):
               output['data'].append([date, float(latitude), 0])
            else:               
               output['data'].append([date, float(latitude), mean])
               
   elif lon != None:
      zMaskedArray = zMaskedArray.swapaxes(1,2)
      
      for i, timelonlat in enumerate(zMaskedArray): 
         #print timelonlat   
         date = None
         if timeUnits:  
            date = netCDF.num2date(time[i], time.units, calendar='standard').isoformat()
         else:    
            date = ''.join(times[i])  
         #output['data'][date.isoformat()] = []
                        
         for j, lonRow in enumerate(timelonlat):
            #print '-------------------------------------'
            #print lonRow  
            longitude = lon[j]            
            #lonArr = []                                  
            #for k, latRow in enumerate(lonRow):
               #lonArr.append(lon[k])                 
            #lonArr = np.array(lonArr)
            #output['data'][date.isoformat()].append([float(longitude), getMean(lonRow)])
            
            mean = getMean(lonRow)
            
            if np.isnan(mean):
               pass
            else:
               output['data'].append([date, float(longitude), mean])          
         
      #current_app.logger.debug(time)
      
   if len(output['data']) < 1:
      g.graphError = "no valid data available to use"
      return output
      
   current_app.logger.debug('Finished basic') # DEBUG
   
   return output
   
"""
Creates a histogram from the provided data. If no bins are created it creates its own.
"""
def histogram(dataset, params):
   var = np.array(dataset.variables[params['coverage'].value]) # Get the coverage as a numpy array
   return {'histogram': getHistogram(var)}

"""
Creates a scatter from the provided data.
"""
def scatter(dataset, params):
   var = np.array(dataset.variables[params['coverage'].value])
   return {'scatter': getScatter(var)}

"""
Returns the raw data.
"""
def raw(dataset, params):
   var = np.array(dataset.variables[params['coverage'].value]) # Get the coverage as a numpy array
   return {'rawdata': var.tolist()}

"""
Returns the median value from the provided array.
"""
def getMedian(arr):
   return float(np.ma.median(arr))

"""
Returns the mean value from the provided array.
"""
def getMean(arr):
   return float(np.mean(arr))

"""
Returns the std value from the provided array.
"""
def getStd(arr):
   return float(np.std(arr))

"""
Returns the minimum value from the provided array. 
"""
def getMin(arr):
   return float(np.min(arr)) # Get the min ignoring nan's, then cast to float

"""
Returns the maximum value from the provided array.
"""
def getMax(arr):
   return float(np.max(arr)) # Get the max ignoring nan's, then cast to float

"""
Returns a histogram created from the provided array. If no bins
are provided, some are created using the min and max values of the array.
"""
def getHistogram(arr):
   maskedarr = np.ma.masked_array(arr, [np.isnan(x) for x in arr])
   bins = request.args.get('bins', None) # TODO move to get params
   numbers = []
   current_app.logger.debug('before bins') # DEBUG
   
   if bins == None or not bins:
      max = getMax(maskedarr)
      min = getMin(maskedarr)
      bins = np.linspace(min, max, 11) # Create ten evenly spaced bins 
      current_app.logger.debug('bins generated') # DEBUG
      N,bins = np.histogram(maskedarr, bins) # Create the histogram
   else:
      values = bins.split(',')
      for i,v in enumerate(values):
         values[i] = float(values[i]) # Cast string to float
      bins = np.array(values)
      current_app.logger.debug('bins converted') # DEBUG
      N,bins = np.histogram(maskedarr, bins) # Create the histogram
   
   current_app.logger.debug('histogram created') # DEBUG
   for i in range(len(bins)-1): # Iter over the bins       
      if np.isnan(bins[i]) or np.isnan(bins[i+1] or np.isnan(N[i])):
         g.graphError = 'no valid data available to use'
         return       
      
      numbers.append((bins[i] + (bins[i+1] - bins[i])/2, float(N[i]))) # Get a number halfway between this bin and the next
   return {'Numbers': numbers, 'Bins': bins.tolist()}

"""
Utility function to find the time dimension from a netcdf file. Needed as the
time dimension will not always have the same name or the same attributes.
"""
def getCoordinateVariable(dataset, axis):
   for i, key in enumerate(dataset.variables):
      var = dataset.variables[key]
      current_app.logger.debug("========== key:" + key + " ===========") # DEBUG
      for name in var.ncattrs():
         current_app.logger.debug(name) # DEBUG
         if name == "_CoordinateAxisType" and var._CoordinateAxisType == axis:
            return var
   
   return None

def getDepth(dataset):
   for i, key in enumerate(dataset.variables):
      var = dataset.variables[key]
      if "_CoordinateAxisType" in var.ncattrs() and "_CoordinateZisPositive" in var.ncattrs():
         if var._CoordinateAxisType == "Height" and var._CoordinateZisPositive == "down":
            return var
   return None

def getDimension(dataset, dimName):
   for i, key in enumerate(dataset.dimensions):
      current_app.logger.debug(key)
      dimension = dataset.dimensions[key]
      if key == dimName:
         return len(dimension)
   
   return None

def getXDimension(dataset):
   pass

def getYDimension(dataset):
   pass

def getUnits(variable):
   for name in variable.ncattrs():
      if name == "units":
         return variable.units
      
   return ''