# -*- coding: utf-8 -*-
"""
    rhodecode.controllers.branches
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    branches controller for rhodecode

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

import logging
import binascii

from pylons import tmpl_context as c

from rhodecode.lib.auth import LoginRequired, HasRepoPermissionAnyDecorator
from rhodecode.lib.base import BaseRepoController, render
from rhodecode.lib.compat import OrderedDict
from rhodecode.lib.utils2 import safe_unicode

log = logging.getLogger(__name__)


class BranchesController(BaseRepoController):

    @LoginRequired()
    @HasRepoPermissionAnyDecorator('repository.read', 'repository.write',
                                   'repository.admin')
    def __before__(self):
        super(BranchesController, self).__before__()

    def index(self):

        def _branchtags(localrepo):
            bt_closed = {}
            for bn, heads in localrepo.branchmap().iteritems():
                tip = heads[-1]
                if 'close' in localrepo.changelog.read(tip)[5]:
                    bt_closed[bn] = tip
            return bt_closed

        cs_g = c.rhodecode_repo.get_changeset

        c.repo_closed_branches = {}
        if c.rhodecode_db_repo.repo_type == 'hg':
            bt_closed = _branchtags(c.rhodecode_repo._repo)
            _closed_branches = [(safe_unicode(n), cs_g(binascii.hexlify(h)),)
                                for n, h in bt_closed.items()]

            c.repo_closed_branches = OrderedDict(sorted(_closed_branches,
                                                    key=lambda ctx: ctx[0],
                                                    reverse=False))

        _branches = [(safe_unicode(n), cs_g(h))
                     for n, h in c.rhodecode_repo.branches.items()]
        c.repo_branches = OrderedDict(sorted(_branches,
                                             key=lambda ctx: ctx[0],
                                             reverse=False))


        return render('branches/branches.html')
