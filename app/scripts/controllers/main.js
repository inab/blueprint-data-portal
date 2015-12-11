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
  .controller('MainCtrl', ['$scope','$sce','$location','$q','portalConfig','QueryService','ChartService','ConstantsService','$timeout','$uibModal','$interpolate',function($scope,$sce,$location,$q, portalConfig, QueryService, ChartService, ConstantsService, $timeout,$modal,$interpolate) {
	
	var SEARCHING_LABEL = "Searching...";
	var SEARCH_LABEL = "Search";
	
	var RANGE_QUERY = 'range';
	var UNION_ADDITIVITY = ' + ';
	var DIFF_ADDITIVITY = ' - ';
	
	var UNION_ADDITIVITY_PATTERN = / *\+ +/;
	var DIFF_ADDITIVITY_PATTERN = / *\- +/;
	
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
    $scope.samplesOnt = [];
    $scope.samples = [];
    $scope.specimens = [];
    $scope.donors = [];
    $scope.labs = [];
    $scope.analyses = [];
    $scope.experimentLabels = [];
    $scope.depth=null;
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
    $scope.chromosomes = [{n:1,c:"chr",f:"images/GRCh38_chromosome_1.svg"},
                    {n:2,c:"chr",f:"images/GRCh38_chromosome_2.svg"},
                    {n:3,c:"chr",f:"images/GRCh38_chromosome_3.svg"},
                    {n:4,c:"chr",f:"images/GRCh38_chromosome_4.svg"},
                    {n:5,c:"chr",f:"images/GRCh38_chromosome_5.svg"},
                    {n:6,c:"chr",f:"images/GRCh38_chromosome_6.svg"},
                    {n:7,c:"chr",f:"images/GRCh38_chromosome_7.svg"},
                    {n:8,c:"chr",f:"images/GRCh38_chromosome_8.svg"},
                    {n:9,c:"chr",f:"images/GRCh38_chromosome_9.svg"},
                    {n:10,c:"chr",f:"images/GRCh38_chromosome_10.svg"},
                    {n:11,c:"chr",f:"images/GRCh38_chromosome_11.svg"},
                    {n:12,c:"chr",f:"images/GRCh38_chromosome_12.svg"},
                    {n:13,c:"chr",f:"images/GRCh38_chromosome_13.svg"},
                    {n:14,c:"chr",f:"images/GRCh38_chromosome_14.svg"},
                    {n:15,c:"chr",f:"images/GRCh38_chromosome_15.svg"},
                    {n:16,c:"chr",f:"images/GRCh38_chromosome_16.svg"},
                    {n:17,c:"chr",f:"images/GRCh38_chromosome_17.svg"},
                    {n:18,c:"chr",f:"images/GRCh38_chromosome_18.svg"},
                    {n:19,c:"chr",f:"images/GRCh38_chromosome_19.svg"},
                    {n:20,c:"chr",f:"images/GRCh38_chromosome_20.svg"},
                    {n:21,c:"chr",f:"images/GRCh38_chromosome_21.svg"},
                    {n:22,c:"chr",f:"images/GRCh38_chromosome_22.svg"},
                    {n:"X",c:"chr",f:"images/GRCh38_chromosome_X.svg"},
                    {n:"Y",c:"chr",f:"images/GRCh38_chromosome_Y.svg"},
                    {n:"MT",c:"chr",f:"images/GRCh38_chromosome_MT.svg"}
                  ];

	$scope.unknownChromosome = { n: "(unknown)", f: "images/chr.svg" };
	
	function openModal(state,message,callback,size) {
		var modalInstance = $modal.open({
			animation: false,
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
	
	function updateLocation(qString,w) {
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
					if(!(flankingWindowSize > 0)) {
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
			localScope.rangeQuery.forEach(function(range,i) {
				var raQuery = range.currentQuery;
				if(raQuery.additivity !== DIFF_ADDITIVITY) {
					if(range.feature_id!==undefined) {
						var featureId = range.feature_id;
						// Removing subversions
						var dotLast = featureId.lastIndexOf('.');
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
						var featureId = range.feature_id;
						// Removing subversions
						var dotLast = featureId.lastIndexOf('.');
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
			//localScope.chromosomes.forEach(function(d){
			//	d.c = "chr";
			//});
			// Now, let's prepare the backbones!
			localScope.graphData = [];
			
			localScope.rangeQuery.forEach(function(range,i) {
				if(!range.isDisabled) {
					console.log('Updating chromosome data '+range.chr);
					//localScope.chromosomes.forEach(function(d){
					//	if(d.n == range.chr) {
					//		d.c = "chr_active";
					//	}
					//});
					
					if(i>0) {
						regions += ' ; ';
					}
					var rangeStr = range.chr+":"+range.start+"-"+range.end;
					
					regions += "<a href='"+ConstantsService.REGION_SEARCH_URI+rangeStr+"' target='_blank'>chr"+rangeStr+"</a>";
					
					// Preparing the charts!
					var termNodes = angular.copy(localScope.termNodes);
					var termNodesHash = {};
					termNodes.forEach(function(termNode) {
						termNodesHash[termNode.o_uri] = termNode;
					});
					var rangeData = {
						toBeFetched: true,
						fetching: false,
						heading: (range.label !== undefined) ? range.label : ('Region ' + range.chr + ':' + range.start + '-' + range.end),
						range: range,
						treedata: null,
						termNodes: termNodes,
						termNodesHash: termNodesHash,
						charts: [],
						stats: {
							bisulfiteSeq: [],
							rnaSeqG: [],
							rnaSeqT: [],
							chipSeq: [],
							dnaseSeq: [],
						},
						gChro: localScope.unknownChromosome,
					};
					
					// Only not taking into account flanking window size for explicit ranges
					if(range.currentQuery.flankingWindowSize !== undefined) {
						rangeData.flankingWindowSize = range.currentQuery.flankingWindowSize;
					}
					
					localScope.chromosomes.some(function(d){
						if(d.n == range.chr) {
							rangeData.gChro = d;
							return true;
						}
						return false;
					});
					
					localScope.graphData.push(rangeData);
				}
			});
			localScope.found = "Query '"+qString+"' displaying information from ";
			localScope.currentQueries.forEach(function(currentQuery) {
				if(currentQuery.additivity !== DIFF_ADDITIVITY) {
					if(currentQuery.queryType !== RANGE_QUERY) {
						var uri = (currentQuery.queryType in ConstantsService.SEARCH_URIS) ? ConstantsService.SEARCH_URIS[currentQuery.queryType] : ConstantsService.DEFAULT_SEARCH_URI;
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
	
	var topFeatures = {
		'gene': null,
		'reaction': null,
		'pathway': null
	};

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
	
	var preprocessQuery = function(localScope) {
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
	};

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
				.then(QueryService.launch(QueryService.getGeneLayout))
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
		
	$scope.doRefresh = function(rangeData) {
		if(rangeData.toBeFetched) {
			rangeData.fetching = true;
			rangeData.toBeFetched = false;
			
			$scope.queryInProgress = true;
			$scope.resultsFetched = 0;
			$scope.maxResultsFetched = 0;
			$scope.searchButtonText = SEARCHING_LABEL;
                        
			var deferred = $q.defer();
			var promise = deferred.promise;
			promise = promise
				.then(QueryService.rangeLaunch(QueryService.getGeneLayout,rangeData))
				.then(QueryService.rangeLaunch(QueryService.getChartData,rangeData), function(err) {
					openModal('Data error','Error while fetching gene layout');
					console.error('Gene layout');
					console.error(err);
				})
				// Either the browser or the server gets too stressed with this concurrent query
				//.then($q.all([QueryService.launch(getWgbsData),QueryService.launch(getRnaSeqGData),QueryService.launch(getRnaSeqTData),QueryService.launch(getChipSeqData),QueryService.launch(getDnaseData)]))
				.then(QueryService.rangeLaunch(QueryService.getWgbsStatsData,rangeData), function(err) {
					if(typeof err === "string") {
						openModal(err,'There is no data stored for '+$scope.currentQueryStr);
					} else {
						openModal('Data error','Error while fetching chart data');
						console.error('Chart data');
						console.error(err);
					}
				})
				.then(QueryService.rangeLaunch(QueryService.getRnaSeqGStatsData,rangeData), function(err) {
					openModal('Data error','Error while computing WGBS stats');
					console.error('WGBS stats data');
					console.error(err);
				})
				.then(QueryService.rangeLaunch(QueryService.getRnaSeqTStatsData,rangeData), function(err) {
					openModal('Data error','Error while computing RNA-Seq (genes) stats');
					console.error('RNA-Seq gene stats data');
					console.error(err);
				})
				.then(QueryService.rangeLaunch(QueryService.getChipSeqStatsData,rangeData), function(err) {
					openModal('Data error','Error while computing RNA-Seq (transcripts) stats');
					console.error('RNA-Seq transcript stats data');
					console.error(err);
				})
				.then(QueryService.rangeLaunch(QueryService.getDnaseStatsData,rangeData), function(err) {
					openModal('Data error','Error while computing ChIP-Seq stats');
					console.error('ChIP-Seq stats data');
					console.error(err);
				})
				.then(QueryService.rangeLaunch(QueryService.initTree,rangeData), function(err) {
					openModal('Data error','Error while computing DNAse stats');
					console.error('DNAse stats data');
					console.error(err);
				}).
				catch(function(err) {
					openModal('Data error','Error while initializing stats tree');
					console.error('Stats tree');
					console.error(err);
				})
				.finally(function() {
					rangeData.fetching = false;
					$scope.queryInProgress = false;
					$scope.searchButtonText = SEARCH_LABEL;
				});
				 
			deferred.resolve($scope);
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
	
	$scope.switchTermNode = function(event,termNode,rangeData) {
		if(event.ctrlKey) {
			rangeData.termNodes.forEach(function(termNode) {
				termNode.termHidden = true;
			});
			termNode.termHidden = false;
		} else {
			termNode.termHidden = !termNode.termHidden;
		}
		
		ChartService.redrawCharts(rangeData);
	};
	
	$scope.switchChart = function(event,chart,rangeData) {
		if(event.ctrlKey) {
			rangeData.charts.forEach(function(chart) {
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
		if(event.shiftKey) {
			rangeData.charts.forEach(function(chart) {
				chart.meanSeriesHidden = false;
			});
			ChartService.redrawCharts(rangeData);
		} else {
			rangeData.charts.forEach(function(chart) {
				chart.isHidden = false;
			});
		}
	};

	$scope.hideAllCharts = function(event,rangeData) {
		if(event.shiftKey) {
			rangeData.charts.forEach(function(chart) {
				chart.meanSeriesHidden = true;
			});
			ChartService.redrawCharts(rangeData);
		} else {
			rangeData.charts.forEach(function(chart) {
				chart.isHidden = true;
			});
		}
	};
	
	$scope.showAllSeries = function(rangeData) {
		rangeData.termNodes.forEach(function(termNode) {
			termNode.termHidden = false;
		});
		
		ChartService.redrawCharts(rangeData);
	};

	$scope.hideAllSeries = function(rangeData) {
		rangeData.termNodes.forEach(function(termNode) {
			termNode.termHidden = true;
		});
		
		ChartService.redrawCharts(rangeData);
	};
	
	$scope.getDataDesc = function() {
		return $interpolate($scope.dataDesc)($scope);
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
	
	function init($q,$scope) {
		var deferred = $q.defer();
		var promise = deferred.promise;
		promise = promise.then(function(localScope) { return $q.all([QueryService.getDonors(localScope),QueryService.getSpecimens(localScope),QueryService.getAnalyses(localScope)]); })
				.then(QueryService.getLabs)
				.then(QueryService.getSamples)
				.then(QueryService.fetchCellTerms);
		
		var w;
		if('w' in $location.search()) {
			w = parseInt($location.search().w);
			if(!(w > 0)) {
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
		$scope.$on('$locationChangeSuccess', function(event) {
			//console.log("Lo vi!!!!!");
			var query;
			var w;
			if('w' in $location.search()) {
				w = parseInt($location.search().w);
				if(!(w > 0)) {
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
