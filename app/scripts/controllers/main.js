'use strict';

/*jshint camelcase: false , quotmark: false */

/**
 * @ngdoc function
 * @name blueprintApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the blueprintApp
 */
angular.module('blueprintApp')
  .controller('MainCtrl', ['$scope','$sce','$location','$q','portalConfig','QueryService','ChartService','ConstantsService','$timeout','$uibModal','$interpolate','$anchorScroll',function($scope,$sce,$location,$q, portalConfig, QueryService, ChartService, ConstantsService, $timeout,$modal,$interpolate,$anchorScroll) {
	
	var SEARCHING_LABEL = "Searching...";
	var PROCESSING_LABEL = "Processing...";
	var SEARCH_LABEL = "Search";
	
	var RANGE_QUERY = 'range';
	var UNION_ADDITIVITY = ' + ';
	var DIFF_ADDITIVITY = ' - ';
	
	var UNION_ADDITIVITY_PATTERN = / *\+ +/;
	var DIFF_ADDITIVITY_PATTERN = / *\- +/;
	
	$scope.commonTreeControlOptions = {
		nodeChildren: "children",
		dirSelectable:true,
		multiSelection:true,
		equality: function(a,b) { return a!==undefined && b!==undefined && a.o_uri === b.o_uri; }
	};
	
    $scope.fetchedTreeData = undefined;

    $scope.info = '<p><a href="http://www.blueprint-epigenome.eu/"><img src="http://dcc.blueprint-epigenome.eu/img/blueprint.png" style="float:left;height:50px;margin-right:20px;"></a>BLUEPRINT is a high impact FP7 project aiming to produce a blueprint of haemopoetic epigenomes. Our goal is to apply highly sophisticated functional genomics analysis on a clearly defined set of primarily human samples from healthy and diseased individuals, and to provide at least 100 <a href="http://ihec-epigenomes.org/research/reference-epigenome-standards/" title="IHEC reference epigenome standards">reference epigenomes</a> to the scientific community. This resource-generating activity will be complemented by research into blood-based diseases, including common leukaemias and autoimmune disease (Type 1 Diabetes), by discovery and validation of epigenetic markers for diagnostic use and by epigenetic target identification.This may eventually lead to the development of novel and more individualised medical treatments. This website will provide links to the data &amp; primary analysis generated by the project.</p>'; 

    $scope.dataRelease = '[Dev without config]';
    $scope.dataDesc = '[Dev without config]';
    if(portalConfig.dataRelease) {
        $scope.dataRelease = portalConfig.dataRelease;
    }
    if(portalConfig.dataDesc) {
        $scope.dataDesc = portalConfig.dataDesc;
    }

    $scope.queryInProgress = false;
    $scope.searchButtonText = SEARCH_LABEL;
    $scope.found = "";
    
    $scope.numHistones = 8;	// Default value
    $scope.numCellularLines = 7;	// Default value
    $scope.histoneMap = {};
    
    $scope.rangeQuery = [];
    $scope.currentQueries = [];
    $scope.currentQueryStr = null;
    
	$scope.graphData = [];
	// The default flanking window size
	$scope.flankingWindowSize = ConstantsService.DEFAULT_FLANKING_WINDOW_SIZE;
	
	// This is for the progress window
	$scope.resultsFetched = 0;
	$scope.maxResultsFetched = 0;
    
    
	$scope.display = 'compact';
	
	
	function openModal(state,message,callback,size) {
		var modalInstance = $modal.open({
			animation: true,
			templateUrl: 'messages.html',
			controller: 'ModalInstanceCtrl',
			//bindToController: true,
			size: size,
			resolve: {
				modalState: function() { return state; },
				modalMessage: function() { return message; },
			}
		});
		
		modalInstance.result.then(callback);
		//    }, function () {
		//      $log.info('Modal dismissed at: ' + new Date());
		//    });
		
	}
	
	ChartService.initializeSubtotalsCharts($scope);

	var preventLocationChange;
	
	function updateLocation(qString/*,w*/) {
		preventLocationChange = true;
		$location.search({q: qString});
	}
	
	function updateChromosomes(localScope) {
		var deferred = $q.defer();
		var promise = deferred.promise;
		
		var blamedQuery;
		var tooMuch = localScope.rangeQuery.some(function(range) {
			tooMuch = ((range.start>=range.end) || (range.end - range.start) > ConstantsService.CHR_SEGMENT_LIMIT);
			if(tooMuch) {
				blamedQuery = range.currentQuery;
			}
			return tooMuch;
		});
		
		if(tooMuch) {
			openModal('Query rejected (too large)','Chromosomical range of (sub)query '+blamedQuery.query+' is larger than '+ConstantsService.CHR_SEGMENT_LIMIT+"bp",function() {
				localScope.query='';
				deferred.reject('Too large query '+blamedQuery.query);
			});
		} else {
			// First, let's update the query string
			var qString='';
			localScope.currentQueries.forEach(function(currentQuery,i) {
				if(i>0 || currentQuery.additivity === DIFF_ADDITIVITY) {
					qString += currentQuery.additivity;
				}
				
				// Curating the value
				var flankingWindowSize;
				
				if(currentQuery.queryType !== RANGE_QUERY && currentQuery.flankingWindowSize !== undefined) {
					flankingWindowSize = parseInt(currentQuery.flankingWindowSize);
					
					// Avoiding objects which are not integers
					if(isNaN(flankingWindowSize) || flankingWindowSize <= 0) {
						flankingWindowSize = undefined;
					}
				}
				
				qString += ( currentQuery.queryType !== RANGE_QUERY ) ? currentQuery.queryType + ':' + currentQuery.query : currentQuery.query;
				if(flankingWindowSize!==undefined) {
					qString += ':'+flankingWindowSize;
				}
			});
			updateLocation(qString);
			
			// Now, let's remove the ranges which overlap
			var overlappers = {};
			localScope.rangeQuery.forEach(function(range) {
				var raQuery = range.currentQuery;
				
				var featureId;
				var dotLast;
				if(raQuery.additivity !== DIFF_ADDITIVITY) {
					if(range.feature_id!==undefined) {
						featureId = range.feature_id;
						// Removing subversions
						dotLast = featureId.lastIndexOf('.');
						if(dotLast!==-1) {
							featureId = featureId.substr(0,dotLast);
						}
						if(featureId in overlappers) {
							var ovQuery = overlappers[featureId].currentQuery;
							if(
								(ovQuery.flankingWindowSize===undefined && raQuery.flankingWindowSize===undefined) ||
								(ovQuery.flankingWindowSize!==undefined && raQuery.flankingWindowSize===undefined) ||
								(ovQuery.flankingWindowSize!==undefined && raQuery.flankingWindowSize!==undefined && ovQuery.flankingWindowSize>=raQuery.flankingWindowSize)
							) {
								range.isDisabled = true;
							} else {
								overlappers[featureId].isDisabled = true;
								overlappers[featureId] = range;
							}
						} else {
							overlappers[featureId] = range;
						}
					}
				} else {
					range.isDisabled = true;
					if(range.feature_id!==undefined) {
						featureId = range.feature_id;
						// Removing subversions
						dotLast = featureId.lastIndexOf('.');
						if(dotLast!==-1) {
							featureId = featureId.substr(0,dotLast);
						}
						if(featureId in overlappers) {
							overlappers[featureId].isDisabled = true;
							delete overlappers[featureId];
						}
					}
				}
			});
			
			var regions = '';
			// Now, let's prepare the backbones!
			localScope.graphData = [];
			
			localScope.rangeQuery.forEach(function(range,i) {
				if(!range.isDisabled) {
					console.log('Updating chromosome data '+range.chr);
					
					if(i>0) {
						regions += ' ; ';
					}
					var rangeStr = range.chr+":"+range.start+"-"+range.end;
					
					regions += "<a href='"+localScope.REGION_SEARCH_URI+rangeStr+"' target='_blank'>chr"+rangeStr+"</a>";
					
					ChartService.storeRange(localScope,range);
				}
			});
			localScope.found = "Query '"+qString+"' displaying information from ";
			localScope.currentQueries.forEach(function(currentQuery) {
				if(currentQuery.additivity !== DIFF_ADDITIVITY) {
					if(currentQuery.queryType !== RANGE_QUERY) {
						var uri = (currentQuery.queryType in localScope.SEARCH_URIS) ? localScope.SEARCH_URIS[currentQuery.queryType] : localScope.DEFAULT_SEARCH_URI;
						var featureLabel = currentQuery.featureLabel !== undefined ? currentQuery.featureLabel : currentQuery.query;
						localScope.found += currentQuery.queryTypeStr+" <a href='"+uri+currentQuery.ensemblGeneId+"' target='_blank'>"+featureLabel+" ["+currentQuery.ensemblGeneId+"]</a>";
					}
					
					if(currentQuery.flankingWindowSize !== undefined) {
						localScope.found += " (&plusmn; "+currentQuery.flankingWindowSize+"bp)";
					}
					localScope.found += ', ';
				}
			});
			localScope.found += "region"+((localScope.rangeQuery.length > 1)?'s':'')+": "+regions;
			
			localScope.graphData.forEach(function(rangeData) {
				// This is needed, as future development can integrate several queries in the tabs
				rangeData.queryFound = localScope.found;
			});
			
			deferred.resolve(localScope);
		}
		
		return promise;
	}
	
	var topFeatures = {};
	topFeatures[ConstantsService.REGION_FEATURE_GENE] = null;
	topFeatures[ConstantsService.REGION_FEATURE_REACTION] = null;
	topFeatures[ConstantsService.REGION_FEATURE_PATHWAY] = null;

	function processRangeMatchNoResults(localScope,origQuery,queryTypes,deferred) {
		var queryTypesStr;
		queryTypes.forEach(function(queryType) {
			if(queryTypesStr!==undefined) {
				queryTypesStr += ' or '+queryType;
			} else {
				queryTypesStr = queryType;
			}
		});
		openModal('No results','Query '+origQuery.query+' did not match any '+queryTypesStr,function() {
			localScope.query='';
			deferred.reject('No results for '+origQuery.query);
		});
	}
	
	function preprocessQuery(localScope) {
		console.log('Running preprocessQuery');
		var deferred = $q.defer();
		var promise = deferred.promise;
		
		localScope.currentQueries = [];
		if(localScope.suggestedQuery.length > 0) {
			localScope.suggestedQuery.forEach(function(suggestedQuery) {
				var currentQuery = {
					query: suggestedQuery.term,
					queryType: suggestedQuery.feature,
					queryTypeStr: suggestedQuery.feature,
					ensemblGeneId: suggestedQuery.feature_cluster_id,
					gotRanges: true,
					flankingWindowSize: parseInt((suggestedQuery.flankingWindowSize!==undefined) ? suggestedQuery.flankingWindowSize : localScope.flankingWindowSize),
					additivity: (suggestedQuery.additivity!==undefined) ? suggestedQuery.additivity : UNION_ADDITIVITY
				};
				localScope.currentQueries.push(currentQuery);
				if(!(suggestedQuery.feature in topFeatures)) {
					currentQuery.queryTypeStr += ' from gene,';
				}
				var featureLabel = ChartService.chooseLabelFromSymbols(suggestedQuery.symbols);
				var isReactome = ConstantsService.isReactome(currentQuery.queryType);
				suggestedQuery.coordinates.forEach(function(range) {
					var theRange = { chr: range.chromosome , start: range.chromosome_start, end: range.chromosome_end, currentQuery: currentQuery };
					
					theRange.label = isReactome ? range.feature_id : featureLabel;
					localScope.rangeQuery.push(theRange);
				});
			});
		} else {
			var q = localScope.query.trim();
			localScope.currentQueryStr = q;
			
			var addi_splitted = q.split(UNION_ADDITIVITY_PATTERN);
			
			var doSchedule;
			addi_splitted.forEach(function(token) {
				var diff_splitted = token.split(DIFF_ADDITIVITY_PATTERN);
				
				diff_splitted.forEach(function(query,iQuery) {
					var q = query.trim();
					if(q.length > 0) {
						var queryType;
						var flankingWindowSize;
						var colonPos = q.indexOf(':');
						var m;
						if(colonPos!==-1) {
							var possibleQueryType = q.substring(0,colonPos);
							if(possibleQueryType in QueryService.my_feature_ranking) {
								queryType = possibleQueryType;
								q = q.substring(colonPos+1);
								
								// Extracting the flanking window size
								var rightColonPos = q.lastIndexOf(':');
								if(rightColonPos!==-1) {
									flankingWindowSize = q.substring(rightColonPos+1);
									q = q.substring(0,rightColonPos);
									flankingWindowSize = parseInt(flankingWindowSize);
								}
							} else {
								m = q.match('^(?:chr)?([^:-]+):([1-9][0-9]*)-([1-9][0-9]*)$');
							}
						}
						
						//range query
						var currentQuery = {
							query: q,
							additivity: (iQuery===0) ? UNION_ADDITIVITY : DIFF_ADDITIVITY
						};
						if(flankingWindowSize!==undefined) {
							currentQuery.flankingWindowSize = flankingWindowSize;
						} else if(m===undefined) {
							currentQuery.flankingWindowSize = localScope.flankingWindowSize;
						}
						localScope.currentQueries.push(currentQuery);
						if(m) {
							if(m[1] === 'M') {
								// Normalizing mitochondrial chromosome name
								m[1] = 'MT';
							}
							currentQuery.queryType = RANGE_QUERY;
							currentQuery.queryTypeStr = RANGE_QUERY;
							currentQuery.gotRanges = true;
							localScope.rangeQuery.push({
								chr: m[1],
								start: parseInt(m[2]),
								end: parseInt(m[3]),
								currentQuery: currentQuery
							});
							// localScope.rangeQuery.chr   = m[1];
							// localScope.rangeQuery.start = m[2];
							// localScope.rangeQuery.end   = m[3];
							// localScope.found = "Displaying information from region: chr"+localScope.rangeQuery[0].chr+":"+localScope.rangeQuery[0].start+"-"+localScope.rangeQuery[0].end;
						} else {
							currentQuery.queryType = queryType;
							currentQuery.queryTypeStr = queryType;
							currentQuery.gotRanges = false;
							
							doSchedule = true;
						}
					}
				});
			});
			if(doSchedule) {
				promise = QueryService.scheduleGetRanges(localScope.currentQueries,processRangeMatchNoResults,promise);
			}
		}
		
		deferred.resolve(localScope);
		
		return promise;
	}

    $scope.resultsSearch = [];
    
	$scope.search = function(theSuggest){
		if(!$scope.queryInProgress) {
			$scope.queryInProgress = true;
			$scope.searchButtonText = SEARCHING_LABEL;
			
			$scope.resultsFetched = 0;
			$scope.maxResultsFetched = 0;
			$scope.found = "";
			$scope.suggestedQuery = [];
			if(theSuggest!==undefined) {
				$scope.suggestedQuery.push(theSuggest);
			}
			$scope.resultsSearch = [];
			
			$scope.rangeQuery = [];
			$scope.currentQueryStr = null;
			
			var deferred = $q.defer();
			var promise = deferred.promise;
			promise = promise.then(preprocessQuery)
				.then(updateChromosomes)
				.then(QueryService.launch(QueryService.getGeneLayout),function(err) {
					openModal('Data error','Error while issuing initial query');
					console.error('updateChromosomes');
					console.error(err);
				})
				.catch(function(err) {
					openModal('Data error','Error while fetching gene layout');
					console.error('Gene layout');
					console.error(err);
				}).finally(function() {
					$scope.queryInProgress = false;
					$scope.searchButtonText = SEARCH_LABEL;
				});
			
			deferred.resolve($scope);
		}
	};
	
	$scope.doReflow = function() {
		setTimeout(function() {
			$scope.$broadcast('highchartsng.reflow');
		},10);
	};
	
	function doRefresh(rangeData) {
		if(rangeData.fetchState === ConstantsService.FETCH_STATE_INITIAL) {
			rangeData.fetchState = ConstantsService.FETCH_STATE_FETCHING;
			
			var localScope = rangeData.localScope;
			localScope.queryInProgress = true;
			localScope.resultsFetched = 0;
			localScope.maxResultsFetched = 0;
			localScope.searchButtonText = PROCESSING_LABEL;
			
			var deferred = $q.defer();
			var promise = deferred.promise;
			promise = promise
				.then(QueryService.rangeLaunch(QueryService.getStatsData,rangeData))
				// Either the browser or the server gets too stressed with this concurrent query
				//.then($q.all([QueryService.launch(getWgbsData),QueryService.launch(getRnaSeqGData),QueryService.launch(getRnaSeqTData),QueryService.launch(getChipSeqData),QueryService.launch(getDnaseData)]))
				.then(QueryService.rangeLaunch(QueryService.getChartData,rangeData), function(err) {
					if(rangeData.fetchState === ConstantsService.FETCH_STATE_FETCHING) {
						rangeData.fetchState = ConstantsService.FETCH_STATE_ERROR;
						openModal('Data error','Error while computing stats');
						console.error('Stats data');
						console.error(err);
					}
				})
				.then(QueryService.rangeLaunch(QueryService.initTree,rangeData), function(err) {
					rangeData.fetchState = ConstantsService.FETCH_STATE_ERROR;
					openModal('Data error','Error while fetching chart data');
					console.error('Chart data');
					console.error(err);
				}).
				then(function(localScope) {
					rangeData.fetchState = ConstantsService.FETCH_STATE_END;
					return localScope;
				},function(err) {
					if(rangeData.fetchState === ConstantsService.FETCH_STATE_FETCHING) {
						rangeData.fetchState = ConstantsService.FETCH_STATE_ERROR;
						openModal('Data error','Error while initializing stats tree');
						console.error('Stats tree');
						console.error(err);
					}
				})
				.finally(function() {
					localScope.queryInProgress = false;
					localScope.searchButtonText = SEARCH_LABEL;
				});
			 
			deferred.resolve(localScope);
		}
		
		return '';
	}
	
	function doInitial(rangeData) {
		var localScope = rangeData.localScope;
		localScope.queryInProgress = true;
		localScope.searchButtonText = SEARCHING_LABEL;
		
		var deferred = $q.defer();
		var promise = deferred.promise;
		promise = promise
			.then(QueryService.rangeLaunch(QueryService.getGeneLayout,rangeData))
			.then(QueryService.rangeLaunch(QueryService.getChartStats,rangeData), function(err) {
				rangeData.state = ConstantsService.STATE_ERROR;
				openModal('Data error','Error while fetching gene layout');
				console.error('Gene layout');
				console.error(err);
			})
			.then(function(localScope) {
				rangeData.state = ConstantsService.STATE_SELECT_CELL_TYPES;
				
				$anchorScroll('resultTabs');
				// Also, fetch data in an asynchronous way
				doRefresh(rangeData);
				
				return localScope;
			}, function(err) {
				if(rangeData.state === ConstantsService.STATE_INITIAL) {
					rangeData.state = ConstantsService.STATE_ERROR;
					if(typeof err === "string") {
						rangeData.fetchState = ConstantsService.FETCH_STATE_NO_DATA;
						//rangeData.state = ConstantsService.STATE_ERROR;
						openModal(err,'There is no data stored for '+localScope.currentQueryStr+' in this range');
					} else {
						openModal('Data error','Error while fetching charts stats');
						console.error('Charts stats');
						console.error(err);
					}
				}
			})
			.finally(function() {
				localScope.queryInProgress = false;
				localScope.searchButtonText = SEARCH_LABEL;
			});
		
		deferred.resolve(localScope);
		
		return '';
	}
	
	$scope.doState = function(rangeData) {
		switch(rangeData.state) {
			case ConstantsService.STATE_INITIAL:
				doInitial(rangeData);
				break;
			case ConstantsService.STATE_SHOW_DATA:
			//	doRefresh(rangeData);
				switch(rangeData.fetchState) {
					case ConstantsService.FETCH_STATE_END:
						ChartService.redrawCharts(rangeData);
						break;
					default:
						console.log("See range");
						console.log(rangeData);
				}
				break;
		}
		
		return '';
	};
	
	$scope.suggestSearch = QueryService.suggestSearch;
	
	$scope.enterSearch = function(keyEvent) {
		if(keyEvent.which === 13) {
			//if($scope.resultsSearch.length > 0) {
			//	$scope.search($scope.resultsSearch[0]);
			//} else {
			if($scope.query.length > 0) {
				$scope.search();
			}
			keyEvent.preventDefault();
		}
	};
	
	$scope.switchSeriesNode = function(event,theSeriesNode,rangeData) {
		var seriesNodes = ChartService.getSeriesNodes(rangeData);
		if(event.ctrlKey) {
			seriesNodes.forEach(function(seriesNode) {
				seriesNode.termHidden = true;
			});
			theSeriesNode.termHidden = false;
		} else {
			theSeriesNode.termHidden = !theSeriesNode.termHidden;
		}
		
		ChartService.redrawCharts(rangeData);
	};
	
	$scope.switchChart = function(event,chart,rangeData) {
		var charts = ChartService.getCharts(rangeData);
		if(event.ctrlKey) {
			charts.forEach(function(chart) {
				chart.isHidden = true;
			});
			chart.isHidden = false;
		} else if(event.shiftKey) {
			chart.meanSeriesHidden = !chart.meanSeriesHidden;
			ChartService.redrawCharts(chart);
		} else {
			chart.isHidden = !chart.isHidden;
		}
	};
	
	$scope.showAllCharts = function(event,rangeData) {
		var charts = ChartService.getCharts(rangeData);
		if(event.shiftKey) {
			charts.forEach(function(chart) {
				chart.meanSeriesHidden = false;
			});
			ChartService.redrawCharts(rangeData);
		} else {
			charts.forEach(function(chart) {
				chart.isHidden = false;
			});
		}
	};

	$scope.hideAllCharts = function(event,rangeData) {
		var charts = ChartService.getCharts(rangeData);
		if(event.shiftKey) {
			charts.forEach(function(chart) {
				chart.meanSeriesHidden = true;
			});
			ChartService.redrawCharts(rangeData);
		} else {
			charts.forEach(function(chart) {
				chart.isHidden = true;
			});
		}
	};
	
	$scope.showAllSeries = function(rangeData) {
		var seriesNodes = ChartService.getSeriesNodes(rangeData);
		seriesNodes.forEach(function(seriesNode) {
			seriesNode.termHidden = false;
		});
		
		ChartService.redrawCharts(rangeData);
	};

	$scope.hideAllSeries = function(rangeData) {
		var seriesNodes = ChartService.getSeriesNodes(rangeData);
		seriesNodes.forEach(function(seriesNode) {
			seriesNode.termHidden = true;
		});
		
		ChartService.redrawCharts(rangeData);
	};
	
	$scope.getCharts = ChartService.getCharts;
	
	$scope.getSeriesNodes = ChartService.getSeriesNodes;
	
	$scope.getGroupBySeriesNodes = ChartService.getGroupBySeriesNodes;
	
	$scope.redrawCharts = ChartService.redrawCharts;
	
	$scope.selectGroup = ChartService.selectGroup;
	
	$scope.getLegendTitle = ChartService.getLegendTitle;
	
	$scope.EXPORTED_VIEWS = ChartService.EXPORTED_VIEWS;
	
	$scope.getDataDesc = function() {
		return $interpolate($scope.dataDesc)($scope);
	};
	
	$scope.getSeenSeriesCount = function(rangeData) {
		var count = 0;
		
		var seriesNodes = ChartService.getSeriesNodes(rangeData);
		seriesNodes.forEach(function(seriesNode) {
			if(seriesNode.wasSeen) {
				count++;
			}
		});
		
		return count;
	};
	
	$scope.getVisibleSeriesCount = function(rangeData) {
		var count = 0;
		
		var seriesNodes = ChartService.getSeriesNodes(rangeData);
		seriesNodes.forEach(function(seriesNode) {
			if(seriesNode.wasSeen && !seriesNode.termHidden) {
				count++;
			}
		});
		
		return count;
	};
	
	$scope.getChartsWithDataCount = function(rangeData) {
		var count = 0;
		
		var charts = ChartService.getCharts(rangeData);
		charts.forEach(function(chart) {
			if(!chart.isEmpty) {
				count++;
			}
		});
		
		return count;
	};
	
	$scope.getVisibleChartsCount = function(rangeData) {
		var count = 0;
		
		var charts = ChartService.getCharts(rangeData);
		charts.forEach(function(chart) {
			if(!chart.isEmpty && !chart.isHidden) {
				count++;
			}
		});
		
		return count;
	};
	
	$scope.removeTabResult = function(event,index) {
		event.stopPropagation();
		var rangeData = $scope.graphData[index];
		if(event.shiftKey) {
			// The code to reflow the query
			var qString=$scope.currentQueryStr;
			qString += DIFF_ADDITIVITY;
			if(rangeData.range.feature_id !== undefined) {
				var queryType;
				var query;
				if(ConstantsService.isReactome(rangeData.range.currentQuery.queryType)) {
					queryType = 'gene';
					query = rangeData.range.feature_id;
				} else {
					queryType = rangeData.range.currentQuery.queryType;
					query = rangeData.range.currentQuery.query;
				}
				qString += queryType + ':' + query;
				if(rangeData.flankingWindowSize!==undefined) {
					qString += ':' + rangeData.flankingWindowSize;
				}
			} else {
				qString += rangeData.range.chr+':'+rangeData.range.start+'-'+rangeData.range.end;
			}
			updateLocation(qString);
		}
		$scope.graphData.splice(index, 1);
	};
	
	$scope.onTreeSelection = function(ontology,node,selected,$event) {
		// Recursively select/unselect behavior only when shift key is pressed
		if($event.shiftKey) {
			if(selected) {
				if(node.children!==undefined) {
					if(ontology.expandedNodes.indexOf(node)===-1) {
						ontology.expandedNodes.push(node);
					}
					var childrenSets = [node.children];
					do {
						var newChildrenSets = [];
						childrenSets.forEach(function(childrenSet) {
							childrenSet.forEach(function(child) {
								if(ontology.selectedNodes.indexOf(child)===-1) {
									ontology.selectedNodes.push(child);
									if(child.children!==undefined) {
										if(ontology.expandedNodes.indexOf(child)===-1) {
											ontology.expandedNodes.push(child);
										}
										newChildrenSets.push(child.children);
									}
								}
							});
						});
						childrenSets = newChildrenSets;
					} while(childrenSets.length > 0);
				}
			} else {
				var parent = node.parent;
				while(parent!==undefined) {
					var parPos = ontology.selectedNodes.indexOf(parent);
					if(parPos===-1) {
						break;
					}
					ontology.selectedNodes.splice(parPos,1);
					parent = parent.parent;
				}
			}
		}
	};
	
	$scope.selectVisibleCellTypes = function(rangeData) {
		var doSelectAll=true;
		
		rangeData.treedata.forEach(function(ontology) {
			ontology.selectedNodes.forEach(function(termNode) {
				if(termNode.wasSeen) {
					doSelectAll=false;
					termNode.termHidden=false;
				}
			});
		});
		
		// Select all when no one was selected
		if(doSelectAll) {
			rangeData.termNodes.forEach(function(termNode) {
				if(termNode.wasSeen) {
					termNode.termHidden=false;
				}
			});
		}
		
		// Changing to this state
		rangeData.state = ConstantsService.STATE_SHOW_DATA;
		$scope.doState(rangeData);
	};
	
	$scope.deselectAllVisibleCellTypes = function(rangeData) {
		rangeData.treedata.forEach(function(ontology) {
			ontology.selectedNodes = [];
		});
	};
	
	function init($q,$scope) {
		var deferred = $q.defer();
		var promise = deferred.promise;
		promise = promise
				.then(QueryService.getDataModel)
				.then(function(localScope) {
					localScope.ensemblVer = localScope.dataModel.annotations.EnsemblVer;
					localScope.ensemblArchive = localScope.dataModel.annotations.EnsemblArchive;
					localScope.gencodeVer = localScope.dataModel.annotations.GENCODEVer;
					localScope.reactomeVer = localScope.dataModel.annotations.ReactomeVer;
					
					localScope.REGION_SEARCH_URI = $interpolate(ConstantsService.REGION_SEARCH_URI)(localScope);
					localScope.DEFAULT_SEARCH_URI = $interpolate(ConstantsService.DEFAULT_SEARCH_URI)(localScope);
					
					var SEARCH_URIS = {};
					for(var key in ConstantsService.SEARCH_URIS) {
						SEARCH_URIS[key] = $interpolate(ConstantsService.SEARCH_URIS[key])(localScope);
					}
					localScope.SEARCH_URIS = SEARCH_URIS;
					//console.log(localScope.dataModel);
					
					return localScope;
				}, function(err) {
					openModal('Initialization error','Error while fetching BLUEPRINT data model');
					console.error('Initialization error DataModel');
					console.error(err);
				})
				.then(QueryService.getSampleTrackingData)
				.then(function(localScope) {
					localScope.numSamples = localScope.samples.length;
					localScope.numHistones = localScope.histones.length; 
					
					return localScope;
				}, function(err) {
					openModal('Initialization error','Error while fetching samples and experiments metadata');
					console.error('Initialization error SampleTrackingData');
					console.error(err);
				})
				.then(QueryService.getAnalysisMetadata)
				.then(QueryService.fetchDiseaseTerms, function(err) {
					openModal('Initialization error','Error while fetching analysis metadata');
					console.error('Initialization error AnalysisMetadata');
					console.error(err);
				})
				.then(QueryService.fetchTissueTerms, function(err) {
					openModal('Initialization error','Error while fetching disease terms metadata');
					console.error('Initialization error DiseaseTerms');
					console.error(err);
				})
				.then(QueryService.fetchCellTerms, function(err) {
					openModal('Initialization error','Error while fetching tissue terms metadata');
					console.error('Initialization error TissueTerms');
					console.error(err);
				})
				.catch(function(err) {
					openModal('Initialization error','Error while fetching cell terms metadata');
					console.error('Initialization error CellTerms');
					console.error(err);
				});
		
		var w;
		if('w' in $location.search()) {
			w = parseInt($location.search().w);
			if(isNaN(w) || w < 0) {
				w = 0;
			}
		}
		
		if('q' in $location.search()) {
			var query = $location.search().q;
			promise = promise.then(function(localScope) {
				if(w!==undefined) {
					localScope.flankingWindowSize = w;
				}
				localScope.query = query;
				localScope.search();
			});
		}
		
		deferred.resolve($scope);
		$scope.$on('$locationChangeStart', function(event) {
			//console.log("He visto algo");
			if($scope.searchInProgress) {
				event.preventDefault();
			}
		});
		$scope.$on('$locationChangeSuccess', function(/*event*/) {
			//console.log("Lo vi!!!!!");
			var query;
			var w;
			if('w' in $location.search()) {
				w = parseInt($location.search().w);
				if(isNaN(w) || w < 0) {
					w = 0;
				}
			}
			if('q' in $location.search()) {
				query = $location.search().q;
				if(w!==undefined) {
					$scope.flankingWindowSize = w;
				}
				$scope.query = query;
			}
			
			if(preventLocationChange) {
				preventLocationChange = false;
			} else if(query!==undefined) {
				$scope.search();
			}
		});
	}
	
	init($q,$scope);
}]);
