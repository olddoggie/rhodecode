# -*- coding: utf-8 -*-
"""
    rhodecode.controllers.admin.repos_groups
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Repositories groups controller for RhodeCode

    :created_on: Mar 23, 2010
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

import logging
import traceback
import formencode

from formencode import htmlfill

from pylons import request, tmpl_context as c, url
from pylons.controllers.util import redirect
from pylons.i18n.translation import _

from sqlalchemy.exc import IntegrityError

import rhodecode
from rhodecode.lib import helpers as h
from rhodecode.lib.ext_json import json
from rhodecode.lib.auth import LoginRequired, HasPermissionAnyDecorator,\
    HasReposGroupPermissionAnyDecorator
from rhodecode.lib.base import BaseController, render
from rhodecode.model.db import RepoGroup, Repository
from rhodecode.model.repos_group import ReposGroupModel
from rhodecode.model.forms import ReposGroupForm
from rhodecode.model.meta import Session
from rhodecode.model.repo import RepoModel
from webob.exc import HTTPInternalServerError, HTTPNotFound
from rhodecode.lib.utils2 import str2bool
from sqlalchemy.sql.expression import func

log = logging.getLogger(__name__)


class ReposGroupsController(BaseController):
    """REST Controller styled on the Atom Publishing Protocol"""
    # To properly map this controller, ensure your config/routing.py
    # file has a resource setup:
    #     map.resource('repos_group', 'repos_groups')

    @LoginRequired()
    def __before__(self):
        super(ReposGroupsController, self).__before__()

    def __load_defaults(self):
        c.repo_groups = RepoGroup.groups_choices()
        c.repo_groups_choices = map(lambda k: unicode(k[0]), c.repo_groups)

        repo_model = RepoModel()
        c.users_array = repo_model.get_users_js()
        c.users_groups_array = repo_model.get_users_groups_js()

    def __load_data(self, group_id):
        """
        Load defaults settings for edit, and update

        :param group_id:
        """
        self.__load_defaults()
        repo_group = RepoGroup.get_or_404(group_id)
        data = repo_group.get_dict()
        data['group_name'] = repo_group.name

        # fill repository users
        for p in repo_group.repo_group_to_perm:
            data.update({'u_perm_%s' % p.user.username:
                             p.permission.permission_name})

        # fill repository groups
        for p in repo_group.users_group_to_perm:
            data.update({'g_perm_%s' % p.users_group.users_group_name:
                             p.permission.permission_name})

        return data

    @HasPermissionAnyDecorator('hg.admin')
    def index(self, format='html'):
        """GET /repos_groups: All items in the collection"""
        # url('repos_groups')
        sk = lambda g: g.parents[0].group_name if g.parents else g.group_name
        c.groups = sorted(RepoGroup.query().all(), key=sk)
        return render('admin/repos_groups/repos_groups_show.html')

    @HasPermissionAnyDecorator('hg.admin')
    def create(self):
        """POST /repos_groups: Create a new item"""
        # url('repos_groups')
        self.__load_defaults()
        repos_group_form = ReposGroupForm(available_groups =
                                          c.repo_groups_choices)()
        try:
            form_result = repos_group_form.to_python(dict(request.POST))
            ReposGroupModel().create(
                    group_name=form_result['group_name'],
                    group_description=form_result['group_description'],
                    parent=form_result['group_parent_id']
            )
            Session().commit()
            h.flash(_('created repos group %s') \
                    % form_result['group_name'], category='success')
            #TODO: in futureaction_logger(, '', '', '', self.sa)
        except formencode.Invalid, errors:

            return htmlfill.render(
                render('admin/repos_groups/repos_groups_add.html'),
                defaults=errors.value,
                errors=errors.error_dict or {},
                prefix_error=False,
                encoding="UTF-8")
        except Exception:
            log.error(traceback.format_exc())
            h.flash(_('error occurred during creation of repos group %s') \
                    % request.POST.get('group_name'), category='error')

        return redirect(url('repos_groups'))

    @HasPermissionAnyDecorator('hg.admin')
    def new(self, format='html'):
        """GET /repos_groups/new: Form to create a new item"""
        # url('new_repos_group')
        self.__load_defaults()
        return render('admin/repos_groups/repos_groups_add.html')

    @HasPermissionAnyDecorator('hg.admin')
    def update(self, id):
        """PUT /repos_groups/id: Update an existing item"""
        # Forms posted to this method should contain a hidden field:
        #    <input type="hidden" name="_method" value="PUT" />
        # Or using helpers:
        #    h.form(url('repos_group', id=ID),
        #           method='put')
        # url('repos_group', id=ID)

        self.__load_defaults()
        c.repos_group = RepoGroup.get(id)

        repos_group_form = ReposGroupForm(
            edit=True,
            old_data=c.repos_group.get_dict(),
            available_groups=c.repo_groups_choices
        )()
        try:
            form_result = repos_group_form.to_python(dict(request.POST))
            ReposGroupModel().update(id, form_result)
            Session().commit()
            h.flash(_('updated repos group %s') \
                    % form_result['group_name'], category='success')
            #TODO: in future action_logger(, '', '', '', self.sa)
        except formencode.Invalid, errors:

            return htmlfill.render(
                render('admin/repos_groups/repos_groups_edit.html'),
                defaults=errors.value,
                errors=errors.error_dict or {},
                prefix_error=False,
                encoding="UTF-8")
        except Exception:
            log.error(traceback.format_exc())
            h.flash(_('error occurred during update of repos group %s') \
                    % request.POST.get('group_name'), category='error')

        return redirect(url('edit_repos_group', id=id))

    @HasPermissionAnyDecorator('hg.admin')
    def delete(self, id):
        """DELETE /repos_groups/id: Delete an existing item"""
        # Forms posted to this method should contain a hidden field:
        #    <input type="hidden" name="_method" value="DELETE" />
        # Or using helpers:
        #    h.form(url('repos_group', id=ID),
        #           method='delete')
        # url('repos_group', id=ID)

        gr = RepoGroup.get(id)
        repos = gr.repositories.all()
        if repos:
            h.flash(_('This group contains %s repositores and cannot be '
                      'deleted') % len(repos),
                    category='error')
            return redirect(url('repos_groups'))

        try:
            ReposGroupModel().delete(id)
            Session().commit()
            h.flash(_('removed repos group %s') % gr.group_name,
                    category='success')
            #TODO: in future action_logger(, '', '', '', self.sa)
        except IntegrityError, e:
            if str(e.message).find('groups_group_parent_id_fkey') != -1:
                log.error(traceback.format_exc())
                h.flash(_('Cannot delete this group it still contains '
                          'subgroups'),
                        category='warning')
            else:
                log.error(traceback.format_exc())
                h.flash(_('error occurred during deletion of repos '
                          'group %s') % gr.group_name, category='error')

        except Exception:
            log.error(traceback.format_exc())
            h.flash(_('error occurred during deletion of repos '
                      'group %s') % gr.group_name, category='error')

        return redirect(url('repos_groups'))

    @HasReposGroupPermissionAnyDecorator('group.admin')
    def delete_repos_group_user_perm(self, group_name):
        """
        DELETE an existing repositories group permission user

        :param group_name:
        """
        try:
            recursive = str2bool(request.POST.get('recursive', False))
            ReposGroupModel().delete_permission(
                repos_group=group_name, obj=request.POST['user_id'],
                obj_type='user', recursive=recursive
            )
            Session().commit()
        except Exception:
            log.error(traceback.format_exc())
            h.flash(_('An error occurred during deletion of group user'),
                    category='error')
            raise HTTPInternalServerError()

    @HasReposGroupPermissionAnyDecorator('group.admin')
    def delete_repos_group_users_group_perm(self, group_name):
        """
        DELETE an existing repositories group permission users group

        :param group_name:
        """

        try:
            recursive = str2bool(request.POST.get('recursive', False))
            ReposGroupModel().delete_permission(
                repos_group=group_name, obj=request.POST['users_group_id'],
                obj_type='users_group', recursive=recursive
            )
            Session().commit()
        except Exception:
            log.error(traceback.format_exc())
            h.flash(_('An error occurred during deletion of group'
                      ' users groups'),
                    category='error')
            raise HTTPInternalServerError()

    def show_by_name(self, group_name):
        """
        This is a proxy that does a lookup group_name -> id, and shows
        the group by id view instead
        """
        group_name = group_name.rstrip('/')
        id_ = RepoGroup.get_by_group_name(group_name)
        if id_:
            return self.show(id_.group_id)
        raise HTTPNotFound

    @HasReposGroupPermissionAnyDecorator('group.read', 'group.write',
                                         'group.admin')
    def show(self, id, format='html'):
        """GET /repos_groups/id: Show a specific item"""
        # url('repos_group', id=ID)

        c.group = RepoGroup.get_or_404(id)
        c.group_repos = c.group.repositories.all()

        #overwrite our cached list with current filter
        gr_filter = c.group_repos
        c.repo_cnt = 0

        groups = RepoGroup.query().order_by(RepoGroup.group_name)\
            .filter(RepoGroup.group_parent_id == id).all()
        c.groups = self.scm_model.get_repos_groups(groups)

        if c.visual.lightweight_dashboard is False:
            c.cached_repo_list = self.scm_model.get_repos(all_repos=gr_filter)

            c.repos_list = c.cached_repo_list
        ## lightweight version of dashboard
        else:
            c.repos_list = Repository.query()\
                            .filter(Repository.group_id == id)\
                            .order_by(func.lower(Repository.repo_name))\
                            .all()
            repos_data = []
            total_records = len(c.repos_list)

            _tmpl_lookup = rhodecode.CONFIG['pylons.app_globals'].mako_lookup
            template = _tmpl_lookup.get_template('data_table/_dt_elements.html')

            quick_menu = lambda repo_name: (template.get_def("quick_menu")
                                            .render(repo_name, _=_, h=h, c=c))
            repo_lnk = lambda name, rtype, private, fork_of: (
                template.get_def("repo_name")
                .render(name, rtype, private, fork_of, short_name=False,
                        admin=False, _=_, h=h, c=c))
            last_change = lambda last_change:  (template.get_def("last_change")
                                           .render(last_change, _=_, h=h, c=c))
            rss_lnk = lambda repo_name: (template.get_def("rss")
                                           .render(repo_name, _=_, h=h, c=c))
            atom_lnk = lambda repo_name: (template.get_def("atom")
                                           .render(repo_name, _=_, h=h, c=c))

            for repo in c.repos_list:
                repos_data.append({
                    "menu": quick_menu(repo.repo_name),
                    "raw_name": repo.repo_name.lower(),
                    "name": repo_lnk(repo.repo_name, repo.repo_type,
                                     repo.private, repo.fork),
                    "last_change": last_change(repo.last_db_change),
                    "desc": repo.description,
                    "owner": h.person(repo.user.username),
                    "rss": rss_lnk(repo.repo_name),
                    "atom": atom_lnk(repo.repo_name),
                })

            c.data = json.dumps({
                "totalRecords": total_records,
                "startIndex": 0,
                "sort": "name",
                "dir": "asc",
                "records": repos_data
            })

        return render('admin/repos_groups/repos_groups.html')

    @HasPermissionAnyDecorator('hg.admin')
    def edit(self, id, format='html'):
        """GET /repos_groups/id/edit: Form to edit an existing item"""
        # url('edit_repos_group', id=ID)

        c.repos_group = ReposGroupModel()._get_repos_group(id)
        defaults = self.__load_data(c.repos_group.group_id)

        # we need to exclude this group from the group list for editing
        c.repo_groups = filter(lambda x: x[0] != c.repos_group.group_id,
                               c.repo_groups)

        return htmlfill.render(
            render('admin/repos_groups/repos_groups_edit.html'),
            defaults=defaults,
            encoding="UTF-8",
            force_defaults=False
        )
