'use strict';

const template = require('./graph-launcher.html');
const _ = require('underscore');
const $ = require('jquery');

angular
.module('dbt')
.directive('graphLauncher', ['$q', 'graph', 'selectorService', 'project', 'trackingService', 'locationService',
    function($q, graph, selectorService, project, trackingService, locationService) {

    var directive = {
        restrict: 'EA',
        replace: true,
        scope: {},
        templateUrl: template,

        link: function(scope, element) {
            scope.filters_visible = false;

            scope.graphService = graph;
            scope.selectorService = selectorService;

            var forms = {
                tags: {
                    visible: false,
                },
                packages: {
                    visible: false,
                }
            };

            scope.onWindowClick = function(e) {
                var target = $(e.target);

                var closest_dropup = $(e.target).closest(".dropup");
                if (!closest_dropup.length) {
                    forms.tags.visible = false;
                    forms.packages.visible = false;
                }

                var clicked_form = closest_dropup.data('form-type')
                _.each(forms, function(form_data, form_name) {
                    if (form_name != clicked_form) {
                        form_data.visible = false;
                    }
                })

                var parent = $(e.target).closest("#graph-viz-wrapper");
                if (parent.length) {
                    setTimeout(function() {
                        $(":focus").blur()
                    });
                }

            }

            scope.onSelectClick = function(clicked_form) {
                _.each(forms, function(form_data, form_name) {
                    if (form_name == clicked_form) {
                        form_data.visible = !form_data.visible;

                        if (!form_data.visible) {
                            $(":focus").blur()
                        }
                    }
                });
            }

            scope.isVisible = function(form_name) {
                return forms[form_name].visible;
            }

            scope.isSelected = function(form_name, item) {
                var dirty = selectorService.selection.dirty[form_name];
                return dirty.indexOf(item) != -1;
            }

            scope.onItemSelect = function(form, item, e) {
                var dirty = selectorService.selection.dirty;
                if (scope.isSelected(form, item)) {
                    dirty[form] = _.without(dirty[form], item);
                } else {
                    dirty[form] = _.union(dirty[form], [item]);
                }

                e.preventDefault();
            }

            scope.onSelectBlur = function(form, $event) {
                if (!$event) {
                    return;
                }

                if ($event.relatedTarget && $event.relatedTarget.tagName != 'SELECT') {
                    // blur it
                } else if (scope.isVisible(form)) {
                    $($event.target).focus();
                }
            }

            scope.selectionLabel = function(form) {
                var model = selectorService.selection.dirty[form];
                var all = selectorService.options[form];

                if (model.length == 0) {
                    return "None selected";
                } else if (model.length == 1) {
                    return model[0];
                } else if (model.length == all.length) {
                    return "All selected";
                } else {
                    return model.length + " selected"
                }
            }

            scope.onUpdateSelector = function() {
                var selector = selectorService.updateSelection();
                var nodes = graph.updateGraph(selector)

                trackingService.track_graph_interaction('update-graph', nodes.length);
            }

            scope.showExpanded = function() {
                var node = selectorService.getViewNode();
                var node_name = node ? node.name : null;
                var nodes = graph.showFullGraph(node_name);

                trackingService.track_graph_interaction('show-expanded', nodes.length);
            }

            scope.showContracted = function() {
                var node = selectorService.getViewNode();
                var nodes = graph.showVerticalGraph(node.name, true);

                locationService.clearState();
                trackingService.track_graph_interaction('show-contracted', nodes.length);
            }

            scope.closeGraph = function() {
                graph.hideGraph();
                locationService.clearState();
            }

            scope.onLauncherClick = function() {
                var node = selectorService.getViewNode();
                if (node) {
                    selectorService.resetSelection(node)
                    scope.showContracted()
                } else {
                    selectorService.resetSelection();
                    scope.showExpanded();
                }
            }

            scope.$watch(function() {
                return selectorService.selection.dirty;
            },
            function(nv, ov) {
                if (!selectorService.isDirty()) {
                    graph.markAllClean();
                    return;
                }

                var dag = graph.graph.pristine.dag;
                var all_nodes = graph.graph.pristine.nodes;

                var clean_selector = selectorService.selection.clean;
                var dirty_selector = selectorService.selection.dirty;

                var clean_nodes = selectorService.select_nodes(dag, all_nodes, clean_selector)
                var dirty_nodes = selectorService.select_nodes(dag, all_nodes, dirty_selector)

                var nodes_to_remove = _.difference(clean_nodes.nodes, dirty_nodes.nodes);

                graph.markDirty(nodes_to_remove)

            }, true);

        }
    };

    return directive;

}]);
