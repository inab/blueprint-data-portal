'use strict';

/*jshint camelcase: false , quotmark: false */

angular.
module('blueprintApp').
factory('ConstantsService',function() {
	var DEFAULT_SEARCH_URI = 'http://{{dataModel.annotations.EnsemblArchive}}.archive.ensembl.org/Human/Search/Results?site=ensembl;facet_species=Human;q=';
	var REGION_SEARCH_URI = 'http://{{dataModel.annotations.EnsemblArchive}}.archive.ensembl.org/Homo_sapiens/Location/View?r=';
	var SEARCH_URIS = {
		gene: 'http://{{dataModel.annotations.EnsemblArchive}}.archive.ensembl.org/Homo_sapiens/Gene/Summary?db=core&g=',
		pathway: 'http://www.reactome.org/content/detail/',
		transcript: 'http://{{dataModel.annotations.EnsemblArchive}}.archive.ensembl.org/Homo_sapiens/Transcript/Summary?db=core&t=',
		reaction: 'http://www.reactome.org/content/detail/',
		region: REGION_SEARCH_URI,
	};
	
	var REGION_FEATURE_GENE = 'gene';
	var REGION_FEATURE_TRANSCRIPT = 'transcript';
	var REGION_FEATURE_REACTION = 'reaction';
	var REGION_FEATURE_PATHWAY = 'pathway';
	var REGION_FEATURE_START_CODON = 'start_codon';
	var REGION_FEATURE_STOP_CODON = 'stop_codon';
	var REGION_FEATURES = [ REGION_FEATURE_GENE , REGION_FEATURE_TRANSCRIPT, REGION_FEATURE_START_CODON, REGION_FEATURE_STOP_CODON ];
	
	return {
		DEFAULT_FLANKING_WINDOW_SIZE: 500,
		CHR_SEGMENT_LIMIT: 2500000,	// A bit larger than largest gene
		
		METADATA_MODEL_INDEX: 'meta-model',
		METADATA_DATA_INDEX: 'metadata',
		PRIMARY_DATA_INDEX: 'primary',
		SAMPLE_TRACKING_DATA_INDEX: 'sample-tracking-data',
		EXTERNAL_DATA_INDEX: 'external',
		
		DONOR_CONCEPT: 'sdata.donor',
		SPECIMEN_CONCEPT: 'sdata.specimen',
		SAMPLE_CONCEPT: 'sdata.sample',
		
		DATA_MODEL_CONCEPT: 'model',
		CVTERM_CONCEPT: 'cvterm',
		
		EXTERNAL_FEATURES_CONCEPT: 'external.features',
		
		DLAT_CONCEPT_M: 'dlat.m',
		PDNA_CONCEPT_M: 'pdna.m',
		EXP_CONCEPT_M: 'exp.m',
		RREG_CONCEPT_M: 'rreg.m',
		
		DLAT_CONCEPT: 'dlat.mr',
		PDNA_CONCEPT: 'pdna.p',
		EXPG_CONCEPT: 'exp.g',
		EXPT_CONCEPT: 'exp.t',
		RREG_CONCEPT: 'rreg.p',
		
		EXPERIMENT_TYPE_DNA_METHYLATION: 'DNA Methylation',
		EXPERIMENT_TYPE_CHROMATIN_ACCESSIBILITY: 'Chromatin Accessibility',
		EXPERIMENT_TYPE_MRNA_SEQ: 'mRNA-seq',
		EXPERIMENT_TYPE_HISTONE_MARK: 'Histone ',
		
		STATE_INITIAL: 'initial',
		STATE_SELECT_CELL_TYPES: 'selectCellTypes',
		STATE_SELECT_CHARTS: 'selectCharts',
		STATE_FETCH_DATA: 'fetchData',
		STATE_NO_DATA: 'no_data',
		STATE_END: 'end',
		STATE_ERROR: 'error',
		
		DEFAULT_SEARCH_URI: DEFAULT_SEARCH_URI,
		REGION_SEARCH_URI: REGION_SEARCH_URI,
		SEARCH_URIS: SEARCH_URIS,
		
		REGION_FEATURE_GENE: REGION_FEATURE_GENE,
		REGION_FEATURE_TRANSCRIPT: REGION_FEATURE_TRANSCRIPT,
		REGION_FEATURE_START_CODON: REGION_FEATURE_START_CODON,
		REGION_FEATURE_STOP_CODON: REGION_FEATURE_STOP_CODON,
		REGION_FEATURE_REACTION: REGION_FEATURE_REACTION,
		REGION_FEATURE_PATHWAY: REGION_FEATURE_PATHWAY,
		REGION_FEATURES: REGION_FEATURES,
		
		isReactome: function(queryType) {
			return ( queryType === 'reaction' || queryType === 'pathway');
		}
	};
});
