# -*- coding: utf-8 -*-
"""
    rhodecode.controllers.files
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Files controller for RhodeCode

    :created_on: Apr 21, 2010
    :author: marcink
    :copyright: (C) 2010-2012 Marcin Kuzminski <marcin@python-works.com>
    :license: GPLv3, see COPYING for more details.
"""
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
from __future__ import with_statement
import os
import logging
import traceback
import tempfile

from pylons import request, response, tmpl_context as c, url
from pylons.i18n.translation import _
from pylons.controllers.util import redirect
from rhodecode.lib.utils import jsonify

from rhodecode.lib import diffs
from rhodecode.lib import helpers as h

from rhodecode.lib.compat import OrderedDict
from rhodecode.lib.utils2 import convert_line_endings, detect_mode, safe_str,\
    str2bool
from rhodecode.lib.auth import LoginRequired, HasRepoPermissionAnyDecorator
from rhodecode.lib.base import BaseRepoController, render
from rhodecode.lib.vcs.backends.base import EmptyChangeset
from rhodecode.lib.vcs.conf import settings
from rhodecode.lib.vcs.exceptions import RepositoryError, \
    ChangesetDoesNotExistError, EmptyRepositoryError, \
    ImproperArchiveTypeError, VCSError, NodeAlreadyExistsError,\
    NodeDoesNotExistError, ChangesetError, NodeError
from rhodecode.lib.vcs.nodes import FileNode

from rhodecode.model.repo import RepoModel
from rhodecode.model.scm import ScmModel
from rhodecode.model.db import Repository

from rhodecode.controllers.changeset import anchor_url, _ignorews_url,\
    _context_url, get_line_ctx, get_ignore_ws


log = logging.getLogger(__name__)


class FilesController(BaseRepoController):

    def __before__(self):
        super(FilesController, self).__before__()
        c.cut_off_limit = self.cut_off_limit

    def __get_cs_or_redirect(self, rev, repo_name, redirect_after=True):
        """
        Safe way to get changeset if error occur it redirects to tip with
        proper message

        :param rev: revision to fetch
        :param repo_name: repo name to redirect after
        """

        try:
            return c.rhodecode_repo.get_changeset(rev)
        except EmptyRepositoryError, e:
            if not redirect_after:
                return None
            url_ = url('files_add_home',
                       repo_name=c.repo_name,
                       revision=0, f_path='')
            add_new = '<a href="%s">[%s]</a>' % (url_, _('click here to add new file'))
            h.flash(h.literal(_('There are no files yet %s') % add_new),
                    category='warning')
            redirect(h.url('summary_home', repo_name=repo_name))

        except RepositoryError, e:
            h.flash(str(e), category='warning')
            redirect(h.url('files_home', repo_name=repo_name, revision='tip'))

    def __get_filenode_or_redirect(self, repo_name, cs, path):
        """
        Returns file_node, if error occurs or given path is directory,
        it'll redirect to top level path

        :param repo_name: repo_name
        :param cs: given changeset
        :param path: path to lookup
        """

        try:
            file_node = cs.get_node(path)
            if file_node.is_dir():
                raise RepositoryError('given path is a directory')
        except RepositoryError, e:
            h.flash(str(e), category='warning')
            redirect(h.url('files_home', repo_name=repo_name,
                           revision=cs.raw_id))

        return file_node

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    def index(self, repo_name, revision, f_path, annotate=False):
        # redirect to given revision from form if given
        post_revision = request.POST.get('at_rev', None)
        if post_revision:
            cs = self.__get_cs_or_redirect(post_revision, repo_name)
            redirect(url('files_home', repo_name=c.repo_name,
                         revision=cs.raw_id, f_path=f_path))

        c.changeset = self.__get_cs_or_redirect(revision, repo_name)
        c.branch = request.GET.get('branch', None)
        c.f_path = f_path
        c.annotate = annotate
        cur_rev = c.changeset.revision

        # prev link
        try:
            prev_rev = c.rhodecode_repo.get_changeset(cur_rev).prev(c.branch)
            c.url_prev = url('files_home', repo_name=c.repo_name,
                         revision=prev_rev.raw_id, f_path=f_path)
            if c.branch:
                c.url_prev += '?branch=%s' % c.branch
        except (ChangesetDoesNotExistError, VCSError):
            c.url_prev = '#'

        # next link
        try:
            next_rev = c.rhodecode_repo.get_changeset(cur_rev).next(c.branch)
            c.url_next = url('files_home', repo_name=c.repo_name,
                     revision=next_rev.raw_id, f_path=f_path)
            if c.branch:
                c.url_next += '?branch=%s' % c.branch
        except (ChangesetDoesNotExistError, VCSError):
            c.url_next = '#'

        # files or dirs
        try:
            c.file = c.changeset.get_node(f_path)

            if c.file.is_file():
                c.load_full_history = False
                file_last_cs = c.file.last_changeset
                c.file_changeset = (c.changeset
                                    if c.changeset.revision < file_last_cs.revision
                                    else file_last_cs)
                _hist = []
                c.file_history = []
                if c.load_full_history:
                    c.file_history, _hist = self._get_node_history(c.changeset, f_path)

                c.authors = []
                for a in set([x.author for x in _hist]):
                    c.authors.append((h.email(a), h.person(a)))
            else:
                c.authors = c.file_history = []
        except RepositoryError, e:
            h.flash(str(e), category='warning')
            redirect(h.url('files_home', repo_name=repo_name,
                           revision='tip'))

        if request.environ.get('HTTP_X_PARTIAL_XHR'):
            return render('files/files_ypjax.html')

        return render('files/files.html')

    def history(self, repo_name, revision, f_path, annotate=False):
        if request.environ.get('HTTP_X_PARTIAL_XHR'):
            c.changeset = self.__get_cs_or_redirect(revision, repo_name)
            c.f_path = f_path
            c.annotate = annotate
            c.file = c.changeset.get_node(f_path)
            if c.file.is_file():
                file_last_cs = c.file.last_changeset
                c.file_changeset = (c.changeset
                                    if c.changeset.revision < file_last_cs.revision
                                    else file_last_cs)
                c.file_history, _hist = self._get_node_history(c.changeset, f_path)
                c.authors = []
                for a in set([x.author for x in _hist]):
                    c.authors.append((h.email(a), h.person(a)))
                return render('files/files_history_box.html')

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    def rawfile(self, repo_name, revision, f_path):
        cs = self.__get_cs_or_redirect(revision, repo_name)
        file_node = self.__get_filenode_or_redirect(repo_name, cs, f_path)

        response.content_disposition = 'attachment; filename=%s' % \
            safe_str(f_path.split(Repository.url_sep())[-1])

        response.content_type = file_node.mimetype
        return file_node.content

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    def raw(self, repo_name, revision, f_path):
        cs = self.__get_cs_or_redirect(revision, repo_name)
        file_node = self.__get_filenode_or_redirect(repo_name, cs, f_path)

        raw_mimetype_mapping = {
            # map original mimetype to a mimetype used for "show as raw"
            # you can also provide a content-disposition to override the
            # default "attachment" disposition.
            # orig_type: (new_type, new_dispo)

            # show images inline:
            'image/x-icon': ('image/x-icon', 'inline'),
            'image/png': ('image/png', 'inline'),
            'image/gif': ('image/gif', 'inline'),
            'image/jpeg': ('image/jpeg', 'inline'),
            'image/svg+xml': ('image/svg+xml', 'inline'),
        }

        mimetype = file_node.mimetype
        try:
            mimetype, dispo = raw_mimetype_mapping[mimetype]
        except KeyError:
            # we don't know anything special about this, handle it safely
            if file_node.is_binary:
                # do same as download raw for binary files
                mimetype, dispo = 'application/octet-stream', 'attachment'
            else:
                # do not just use the original mimetype, but force text/plain,
                # otherwise it would serve text/html and that might be unsafe.
                # Note: underlying vcs library fakes text/plain mimetype if the
                # mimetype can not be determined and it thinks it is not
                # binary.This might lead to erroneous text display in some
                # cases, but helps in other cases, like with text files
                # without extension.
                mimetype, dispo = 'text/plain', 'inline'

        if dispo == 'attachment':
            dispo = 'attachment; filename=%s' % \
                        safe_str(f_path.split(os.sep)[-1])

        response.content_disposition = dispo
        response.content_type = mimetype
        return file_node.content

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.write', 'repository.admin')
    def edit(self, repo_name, revision, f_path):
        repo = Repository.get_by_repo_name(repo_name)
        if repo.enable_locking and repo.locked[0]:
            h.flash(_('This repository is has been locked by %s on %s')
                % (h.person_by_id(repo.locked[0]),
                   h.fmt_date(h.time_to_datetime(repo.locked[1]))),
                  'warning')
            return redirect(h.url('files_home',
                                  repo_name=repo_name, revision='tip'))

        r_post = request.POST

        c.cs = self.__get_cs_or_redirect(revision, repo_name)
        c.file = self.__get_filenode_or_redirect(repo_name, c.cs, f_path)

        if c.file.is_binary:
            return redirect(url('files_home', repo_name=c.repo_name,
                         revision=c.cs.raw_id, f_path=f_path))

        c.f_path = f_path

        if r_post:

            old_content = c.file.content
            sl = old_content.splitlines(1)
            first_line = sl[0] if sl else ''
            # modes:  0 - Unix, 1 - Mac, 2 - DOS
            mode = detect_mode(first_line, 0)
            content = convert_line_endings(r_post.get('content'), mode)

            message = r_post.get('message') or (_('Edited %s via RhodeCode')
                                                % (f_path))
            author = self.rhodecode_user.full_contact

            if content == old_content:
                h.flash(_('No changes'),
                    category='warning')
                return redirect(url('changeset_home', repo_name=c.repo_name,
                                    revision='tip'))

            try:
                self.scm_model.commit_change(repo=c.rhodecode_repo,
                                             repo_name=repo_name, cs=c.cs,
                                             user=self.rhodecode_user,
                                             author=author, message=message,
                                             content=content, f_path=f_path)
                h.flash(_('Successfully committed to %s') % f_path,
                        category='success')

            except Exception:
                log.error(traceback.format_exc())
                h.flash(_('Error occurred during commit'), category='error')
            return redirect(url('changeset_home',
                                repo_name=c.repo_name, revision='tip'))

        return render('files/files_edit.html')

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.write', 'repository.admin')
    def add(self, repo_name, revision, f_path):

        repo = Repository.get_by_repo_name(repo_name)
        if repo.enable_locking and repo.locked[0]:
            h.flash(_('This repository is has been locked by %s on %s')
                % (h.person_by_id(repo.locked[0]),
                   h.fmt_date(h.time_to_datetime(repo.locked[1]))),
                  'warning')
            return redirect(h.url('files_home',
                                  repo_name=repo_name, revision='tip'))

        r_post = request.POST
        c.cs = self.__get_cs_or_redirect(revision, repo_name,
                                         redirect_after=False)
        if c.cs is None:
            c.cs = EmptyChangeset(alias=c.rhodecode_repo.alias)

        c.f_path = f_path

        if r_post:
            unix_mode = 0
            content = convert_line_endings(r_post.get('content'), unix_mode)

            message = r_post.get('message') or (_('Added %s via RhodeCode')
                                                % (f_path))
            location = r_post.get('location')
            filename = r_post.get('filename')
            file_obj = r_post.get('upload_file', None)

            if file_obj is not None and hasattr(file_obj, 'filename'):
                filename = file_obj.filename
                content = file_obj.file

            node_path = os.path.join(location, filename)
            author = self.rhodecode_user.full_contact

            if not content:
                h.flash(_('No content'), category='warning')
                return redirect(url('changeset_home', repo_name=c.repo_name,
                                    revision='tip'))
            if not filename:
                h.flash(_('No filename'), category='warning')
                return redirect(url('changeset_home', repo_name=c.repo_name,
                                    revision='tip'))

            try:
                self.scm_model.create_node(repo=c.rhodecode_repo,
                                           repo_name=repo_name, cs=c.cs,
                                           user=self.rhodecode_user,
                                           author=author, message=message,
                                           content=content, f_path=node_path)
                h.flash(_('Successfully committed to %s') % node_path,
                        category='success')
            except NodeAlreadyExistsError, e:
                h.flash(_(e), category='error')
            except Exception:
                log.error(traceback.format_exc())
                h.flash(_('Error occurred during commit'), category='error')
            return redirect(url('changeset_home',
                                repo_name=c.repo_name, revision='tip'))

        return render('files/files_add.html')

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    def archivefile(self, repo_name, fname):

        fileformat = None
        revision = None
        ext = None
        subrepos = request.GET.get('subrepos') == 'true'

        for a_type, ext_data in settings.ARCHIVE_SPECS.items():
            archive_spec = fname.split(ext_data[1])
            if len(archive_spec) == 2 and archive_spec[1] == '':
                fileformat = a_type or ext_data[1]
                revision = archive_spec[0]
                ext = ext_data[1]

        try:
            dbrepo = RepoModel().get_by_repo_name(repo_name)
            if dbrepo.enable_downloads is False:
                return _('downloads disabled')

            if c.rhodecode_repo.alias == 'hg':
                # patch and reset hooks section of UI config to not run any
                # hooks on fetching archives with subrepos
                for k, v in c.rhodecode_repo._repo.ui.configitems('hooks'):
                    c.rhodecode_repo._repo.ui.setconfig('hooks', k, None)

            cs = c.rhodecode_repo.get_changeset(revision)
            content_type = settings.ARCHIVE_SPECS[fileformat][0]
        except ChangesetDoesNotExistError:
            return _('Unknown revision %s') % revision
        except EmptyRepositoryError:
            return _('Empty repository')
        except (ImproperArchiveTypeError, KeyError):
            return _('Unknown archive type')

        fd, archive = tempfile.mkstemp()
        t = open(archive, 'wb')
        cs.fill_archive(stream=t, kind=fileformat, subrepos=subrepos)
        t.close()

        def get_chunked_archive(archive):
            stream = open(archive, 'rb')
            while True:
                data = stream.read(16 * 1024)
                if not data:
                    stream.close()
                    os.close(fd)
                    os.remove(archive)
                    break
                yield data

        response.content_disposition = str('attachment; filename=%s-%s%s' \
                                           % (repo_name, revision[:12], ext))
        response.content_type = str(content_type)
        return get_chunked_archive(archive)

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    def diff(self, repo_name, f_path):
        ignore_whitespace = request.GET.get('ignorews') == '1'
        line_context = request.GET.get('context', 3)
        diff1 = request.GET.get('diff1', '')
        diff2 = request.GET.get('diff2', '')
        c.action = request.GET.get('diff')
        c.no_changes = diff1 == diff2
        c.f_path = f_path
        c.big_diff = False
        c.anchor_url = anchor_url
        c.ignorews_url = _ignorews_url
        c.context_url = _context_url
        c.changes = OrderedDict()
        c.changes[diff2] = []

        #special case if we want a show rev only, it's impl here
        #to reduce JS and callbacks

        if request.GET.get('show_rev'):
            if str2bool(request.GET.get('annotate', 'False')):
                _url = url('files_annotate_home', repo_name=c.repo_name,
                           revision=diff1, f_path=c.f_path)
            else:
                _url = url('files_home', repo_name=c.repo_name,
                           revision=diff1, f_path=c.f_path)

            return redirect(_url)
        try:
            if diff1 not in ['', None, 'None', '0' * 12, '0' * 40]:
                c.changeset_1 = c.rhodecode_repo.get_changeset(diff1)
                try:
                    node1 = c.changeset_1.get_node(f_path)
                except NodeDoesNotExistError:
                    c.changeset_1 = EmptyChangeset(cs=diff1,
                                                   revision=c.changeset_1.revision,
                                                   repo=c.rhodecode_repo)
                    node1 = FileNode(f_path, '', changeset=c.changeset_1)
            else:
                c.changeset_1 = EmptyChangeset(repo=c.rhodecode_repo)
                node1 = FileNode(f_path, '', changeset=c.changeset_1)

            if diff2 not in ['', None, 'None', '0' * 12, '0' * 40]:
                c.changeset_2 = c.rhodecode_repo.get_changeset(diff2)
                try:
                    node2 = c.changeset_2.get_node(f_path)
                except NodeDoesNotExistError:
                    c.changeset_2 = EmptyChangeset(cs=diff2,
                                                   revision=c.changeset_2.revision,
                                                   repo=c.rhodecode_repo)
                    node2 = FileNode(f_path, '', changeset=c.changeset_2)
            else:
                c.changeset_2 = EmptyChangeset(repo=c.rhodecode_repo)
                node2 = FileNode(f_path, '', changeset=c.changeset_2)
        except (RepositoryError, NodeError):
            log.error(traceback.format_exc())
            return redirect(url('files_home', repo_name=c.repo_name,
                                f_path=f_path))

        if c.action == 'download':
            _diff = diffs.get_gitdiff(node1, node2,
                                      ignore_whitespace=ignore_whitespace,
                                      context=line_context)
            diff = diffs.DiffProcessor(_diff, format='gitdiff')

            diff_name = '%s_vs_%s.diff' % (diff1, diff2)
            response.content_type = 'text/plain'
            response.content_disposition = (
                'attachment; filename=%s' % diff_name
            )
            return diff.as_raw()

        elif c.action == 'raw':
            _diff = diffs.get_gitdiff(node1, node2,
                                      ignore_whitespace=ignore_whitespace,
                                      context=line_context)
            diff = diffs.DiffProcessor(_diff, format='gitdiff')
            response.content_type = 'text/plain'
            return diff.as_raw()

        else:
            fid = h.FID(diff2, node2.path)
            line_context_lcl = get_line_ctx(fid, request.GET)
            ign_whitespace_lcl = get_ignore_ws(fid, request.GET)

            lim = request.GET.get('fulldiff') or self.cut_off_limit
            _, cs1, cs2, diff, st = diffs.wrapped_diff(filenode_old=node1,
                                         filenode_new=node2,
                                         cut_off_limit=lim,
                                         ignore_whitespace=ign_whitespace_lcl,
                                         line_context=line_context_lcl,
                                         enable_comments=False)
            op = ''
            filename = node1.path
            cs_changes = {
                'fid': [cs1, cs2, op, filename, diff, st]
            }
            c.changes = cs_changes

        return render('files/file_diff.html')

    def _get_node_history(self, cs, f_path, changesets=None):
        """
        get changesets history for given node

        :param cs: changeset to calculate history
        :param f_path: path for node to calculate history for
        :param changesets: if passed don't calculate history and take
            changesets defined in this list
        """
        # calculate history based on tip
        tip_cs = c.rhodecode_repo.get_changeset()
        if changesets is None:
            try:
                changesets = tip_cs.get_file_history(f_path)
            except (NodeDoesNotExistError, ChangesetError):
                #this node is not present at tip !
                changesets = cs.get_file_history(f_path)
        hist_l = []

        changesets_group = ([], _("Changesets"))
        branches_group = ([], _("Branches"))
        tags_group = ([], _("Tags"))
        _hg = cs.repository.alias == 'hg'
        for chs in changesets:
            #_branch = '(%s)' % chs.branch if _hg else ''
            _branch = chs.branch
            n_desc = 'r%s:%s (%s)' % (chs.revision, chs.short_id, _branch)
            changesets_group[0].append((chs.raw_id, n_desc,))
        hist_l.append(changesets_group)

        for name, chs in c.rhodecode_repo.branches.items():
            branches_group[0].append((chs, name),)
        hist_l.append(branches_group)

        for name, chs in c.rhodecode_repo.tags.items():
            tags_group[0].append((chs, name),)
        hist_l.append(tags_group)

        return hist_l, changesets

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    @jsonify
    def nodelist(self, repo_name, revision, f_path):
        if request.environ.get('HTTP_X_PARTIAL_XHR'):
            cs = self.__get_cs_or_redirect(revision, repo_name)
            _d, _f = ScmModel().get_nodes(repo_name, cs.raw_id, f_path,
                                          flat=False)
            return {'nodes': _d + _f}
