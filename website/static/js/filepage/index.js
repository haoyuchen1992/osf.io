var $ = require('jquery');
var m = require('mithril');
var mime = require('js/mime');
var bootbox = require('bootbox');
var $osf = require('js/osfHelpers');
var waterbutler = require('js/waterbutler');

// Local requires
var utils = require('./util.js');
var FileEditor = require('./editor.js');
var FileRevisionsTable = require('./revisions.js');
var storageAddons = require('json!storageAddons.json');

// Sanity
var Panel = utils.Panel;


var EDITORS = {'text': FileEditor};


var FileViewPage = {
    controller: function(context) {
        var self = this;
        self.context = context;
        self.file = self.context.file;
        self.node = self.context.node;
        self.editorMeta = self.context.editor;
        self.file.renter = '';
        self.request_done = false;
        self.file.permission = 'read';
        self.isRenter = function() {
            $.ajax({
                method: 'get',
                url: '/api/v1/project/' +self.node.id + '/osfstorage' + self.file.path + '/rented/',
            }).done(function(resp) {
                self.request_done = true;
                self.file.renter = resp.renter;
                self.file.permission = resp.permission;
                if ((self.file.renter !== '') && (self.file.renter !== self.context.userId)) {
                $osf.growl('File is checked-out', 'This file has been checked-out by a <a href="/' + self.file.renter +
                    '"> collaborator </a>. It needs to be checked back in before any changes can be made.');
            }
            }).fail(function(resp) {
            });
        };
        if (self.file.provider === 'osfstorage'){
            self.canEdit = function() {
                return ((self.file.renter === '') || (self.file.renter === self.context.userId)) ? m.prop(!!self.context.currentUser.canEdit) : false;
            };
            self.isRenter();
        } else {
            self.request_done = true;
            self.canEdit = function() {
                return m.prop(!!self.context.currentUser.canEdit);
            };
        }
        
        $.extend(self.file.urls, {
            delete: waterbutler.buildDeleteUrl(self.file.path, self.file.provider, self.node.id),
            metadata: waterbutler.buildMetadataUrl(self.file.path, self.file.provider, self.node.id),
            revisions: waterbutler.buildRevisionsUrl(self.file.path, self.file.provider, self.node.id),
            content: waterbutler.buildDownloadUrl(self.file.path, self.file.provider, self.node.id, {accept_url: false, mode: 'render'})
        });

        if ($osf.urlParams().branch) {
            self.file.urls.revisions = waterbutler.buildRevisionsUrl(self.file.path, self.file.provider, self.node.id, {sha: $osf.urlParams().branch});
            self.file.urls.content = waterbutler.buildDownloadUrl(self.file.path, self.file.provider, self.node.id, {accept_url: false, mode: 'render', branch: $osf.urlParams().branch});
        }

        $(document).on('fileviewpage:delete', function() {
            bootbox.confirm({
                title: 'Delete file?',
                message: '<p class="overflow">' +
                        'Are you sure you want to delete <strong>' +
                        self.file.safeName + '</strong>?' +
                    '</p>',
                callback: function(confirm) {
                    if (!confirm) {
                        return;
                    }
                    $.ajax({
                        type: 'DELETE',
                        url: self.file.urls.delete,
                        beforeSend: $osf.setXHRAuthorization
                    }).done(function() {
                        window.location = self.node.urls.files;
                    }).fail(function() {
                        $osf.growl('Error', 'Could not delete file.');
                    });
                },
                buttons:{
                    confirm:{
                        label:'Delete',
                        className:'btn-danger'
                    }
                }
            });
        });
        $(document).on('fileviewpage:rent', function() {
            bootbox.confirm({
                title: 'Confirm file check-out?',
                message: 'This would mean ' +
                    'other contributors cannot edit, delete or upload new versions of this file ' +
                    'as long as it is checked-out. You can check it back in at anytime.',
                callback: function(confirm) {
                    if (!confirm) {
                        return;
                    }
                    $osf.postJSON(
                        '/api/v1/project/' + self.node.id + '/osfstorage' + self.file.path +'/rent/',
                        {}
                    ).done(function(resp) {
                        window.location.reload();
                    }).fail(function(resp) {
                        $osf.growl('Error', 'Unable to check-out file');
                    });
                },
                buttons:{
                    confirm:{
                        label: 'Check-out file',
                        className: 'btn-warning'
                    }
                }
            });
        });
        $(document).on('fileviewpage:return', function() {
            $osf.postJSON(
                '/api/v1/project/' + self.node.id + '/osfstorage' + self.file.path +'/return/',
                {}
            ).done(function(resp) {
                window.location.reload();
            }).fail(function(resp) {
                $osf.growl('Error', 'Unable to check-in file');
            });
        });
        $(document).on('fileviewpage:force_return', function() {
            bootbox.confirm({
                title: 'Force check-in file?',
                message: 'This will check-in the file for all users, allowing it to be edited. Are you sure?',
                buttons: {
                    confirm:{
                        label: 'Force check-in',
                        className: 'btn-danger'
                    }
                },
                callback: function(confirm) {
                    if (!confirm) {
                        return;
                    }
                    $osf.postJSON(
                        '/api/v1/project/' + self.node.id + '/osfstorage' + self.file.path +'/force_return/',
                        {}
                    ).done(function(resp) {
                        window.location.reload();
                    }).fail(function(resp) {
                        $osf.growl('Error', 'Unable to force check-in file, make sure you have admin privileges.');
                    });
                }

            });
        });
        $(document).on('fileviewpage:download', function() {
            window.location = self.file.urls.content;
            return false;
        });

        self.shareJSObservables = {
            activeUsers: m.prop([]),
            status: m.prop('connecting'),
            userId: self.context.currentUser.id
        };

        self.editHeader = function() {
            return m('.row', [
                m('.col-sm-12', m('span[style=display:block;]', [
                    m('h3.panel-title',[m('i.fa.fa-pencil-square-o'), '   Edit ']),
                    m('.pull-right', [
                        m('.progress.no-margin.pointer', {
                            'data-toggle': 'modal',
                            'data-target': '#' + self.shareJSObservables.status() + 'Modal'
                        }, [
                            m('.progress-bar.p-h-sm.progress-bar-success', {
                                connected: {
                                    style: 'width: 100%',
                                    class: 'progress-bar progress-bar-success'
                                },
                                connecting: {
                                    style: 'width: 100%',
                                    class: 'progress-bar progress-bar-warning progress-bar-striped active'
                                },
                                saving: {
                                    style: 'width: 100%',
                                    class: 'progress-bar progress-bar-info progress-bar-striped active'
                                }
                            }[self.shareJSObservables.status()] || {
                                    style: 'width: 100%',
                                    class: 'progress-bar progress-bar-danger'
                                }, [
                                    m('span.progress-bar-content', [
                                        {
                                            connected: 'Live editing mode ',
                                            connecting: 'Attempting to connect ',
                                            unsupported: 'Unsupported browser ',
                                            saving: 'Saving... '
                                        }[self.shareJSObservables.status()] || 'Unavailable: Live editing ',
                                        m('i.fa.fa-question-circle.fa-large')
                                    ])
                                ])
                            ])
                        ])
                    ]))
                ]);
        };


        // Hack to delay creation of the editor
        // until we know this is the current file revsion
        self.enableEditing = function() {
            // Sometimes we can get here twice, check just in case
            if (self.editor || !self.canEdit()) {
                m.redraw(true);
                return;
            }
            var fileType = mime.lookup(self.file.name.toLowerCase());
            // Only allow files < 1MB to be editable
            if (self.file.size < 1048576 && fileType) { //May return false
                var editor = EDITORS[fileType.split('/')[0]];
                if (editor) {
                    self.editor = new Panel('Edit', self.editHeader, editor, [self.file.urls.content, self.file.urls.sharejs, self.editorMeta, self.shareJSObservables], false);
                }
            }
            m.redraw(true);
        };

        //Hack to polyfill the Panel interface
        //Ran into problems with mithrils caching messing up with multiple "Panels"
        self.revisions = m.component(FileRevisionsTable, self.file, self.node, self.enableEditing, self.canEdit);
        self.revisions.selected = false;
        self.revisions.title = 'Revisions';

        // inform the mfr of a change in display size performed via javascript,
        // otherwise the mfr iframe will not update unless the document windows is changed.
        self.triggerResize = $osf.throttle(function () {
            $(document).trigger('fileviewpage:resize');
        }, 1000);

        self.mfrIframeParent = $('#mfrIframeParent');
    },
    view: function(ctrl) {
        //This code was abstracted into a panel toggler at one point
        //it was removed and shoved here due to issues with mithrils caching and interacting
        //With other non-mithril components on the page
        var panels;
        if (ctrl.editor) {
            panels = [ctrl.editor, ctrl.revisions];
        } else {
            panels = [ctrl.revisions];
        }

        var shown = panels.reduce(function(accu, panel) {
            return accu + (panel.selected ? 1 : 0);
        }, 0);

        var panelsShown = shown + (ctrl.mfrIframeParent.is(':visible') ? 1 : 0);
        var mfrIframeParentLayout;
        var fileViewPanelsLayout;

        if (panelsShown === 3) {
            // view | edit | revisions
            mfrIframeParentLayout = 'col-sm-4';
            fileViewPanelsLayout = 'col-sm-8';
        } else if (panelsShown === 2) {
            if (ctrl.mfrIframeParent.is(':visible')) {
                if (ctrl.revisions.selected) {
                    // view | revisions
                    mfrIframeParentLayout = 'col-sm-8';
                    fileViewPanelsLayout = 'col-sm-4';
                } else {
                    // view | edit
                    mfrIframeParentLayout = 'col-sm-6';
                    fileViewPanelsLayout = 'col-sm-6';
                }
            } else {
                // edit | revisions
                mfrIframeParentLayout = '';
                fileViewPanelsLayout = 'col-sm-12';
            }
        } else {
            // view
            if (ctrl.mfrIframeParent.is(':visible')) {
                mfrIframeParentLayout = 'col-sm-12';
                fileViewPanelsLayout = '';
            } else {
                // edit or revisions
                mfrIframeParentLayout = '';
                fileViewPanelsLayout = 'col-sm-12';
            }
        }
        $('#mfrIframeParent').removeClass().addClass(mfrIframeParentLayout);
        $('.file-view-panels').removeClass().addClass('file-view-panels').addClass(fileViewPanelsLayout);

        if(ctrl.file.urls.external && !ctrl.file.privateRepo) {
            m.render(document.getElementById('externalView'), [
                m('p.text-muted', 'View this file on ', [
                    m('a', {href:ctrl.file.urls.external}, storageAddons[ctrl.file.provider].fullName)
                ], '.')
            ]);
        }

        m.render(document.getElementById('toggleBar'), m('.btn-toolbar.m-t-md', [
            ctrl.canEdit() && (ctrl.file.renter === '') && ctrl.request_done ? m('.btn-group.m-l-xs.m-t-xs', [
                m('.btn.btn-sm.btn-danger.file-delete', {onclick: $(document).trigger.bind($(document), 'fileviewpage:delete')}, 'Delete')
            ]) : '',
            ctrl.context.currentUser.canEdit && (!ctrl.canEdit()) && ctrl.request_done && (ctrl.file.permission === 'admin') ? m('.btn-group.m-l-xs.m-t-xs', [
                m('.btn.btn-sm.btn-danger', {onclick: $(document).trigger.bind($(document), 'fileviewpage:force_return')}, 'Force Check-in')
            ]) : '',
            ctrl.canEdit() && (ctrl.file.renter === '') && ctrl.request_done && (ctrl.file.provider === 'osfstorage') ? m('.btn-group.m-l-xs.m-t-xs', [
                m('.btn.btn-sm.btn-warning', {onclick: $(document).trigger.bind($(document), 'fileviewpage:rent')}, 'Check-out')
            ]) : '',
            (ctrl.canEdit() && (ctrl.file.renter === ctrl.context.userId) && ctrl.request_done) ? m('.btn-group.m-l-xs.m-t-xs', [
                m('.btn.btn-sm.btn-warning', {onclick: $(document).trigger.bind($(document), 'fileviewpage:return')}, 'Check-in')
            ]) : '',
            m('.btn-group.m-t-xs', [
                m('.btn.btn-sm.btn-primary.file-download', {onclick: $(document).trigger.bind($(document), 'fileviewpage:download')}, 'Download')
            ]),
            m('.btn-group.btn-group-sm.m-t-xs', [
                m('.btn.btn-default.disabled', 'Toggle view: ')
            ].concat(
                m('.btn' + (ctrl.mfrIframeParent.is(':visible') ? '.btn-primary' : '.btn-default'), {
                    onclick: function (e) {
                        e.preventDefault();
                        // atleast one button must remain enabled.
                        if (!ctrl.mfrIframeParent.is(':visible') || panelsShown > 1) {
                            ctrl.mfrIframeParent.toggle();
                        }
                    }
                }, 'View')
            ).concat(
                panels.map(function(panel) {
                    return m('.btn' + (panel.selected ? '.btn-primary' : '.btn-default'), {
                        onclick: function(e) {
                            e.preventDefault();
                            // atleast one button must remain enabled.
                            if (!panel.selected || panelsShown > 1) {
                                panel.selected = !panel.selected;
                            }
                        }
                    }, panel.title);
                })
            ))
        ]));

        return m('.file-view-page', m('.panel-toggler', [
            m('.row', panels.map(function(pane, index) {
                ctrl.triggerResize();
                if (!pane.selected) {
                    return m('[style="display:none"]', pane);
                }
                return m('.col-sm-' + Math.floor(12/shown), pane);
            }))
        ]));
    }
};

module.exports = function(context) {
    // Treebeard forces all mithril to load twice, to avoid
    // destroying the page iframe this out side of mithril.
    if (!context.file.urls.render) {
        $('#mfrIframe').html(context.file.error);
    } else {
        var url = context.file.urls.render;
        if (context.accessToken) {
            url += '&token=' + context.accessToken;
        }

        if (window.mfr !== undefined) {
            var mfrRender = new mfr.Render('mfrIframe', url);
            $(document).on('fileviewpage:reload', function() {
                mfrRender.reload();
            });
            $(document).on('fileviewpage:resize', function() {
                mfrRender.resize();
            });
        }

    }

    return m.component(FileViewPage, context);
};
