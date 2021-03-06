from rhodecode.tests import *

class TestTagsController(TestController):

    def test_index(self):
        self.log_user()
        response = self.app.get(url(controller='tags', action='index', repo_name=HG_REPO))
        response.mustcontain("""<a href="/%s/files/27cd5cce30c96924232dffcd24178a07ffeb5dfc/">tip</a>""" % HG_REPO)
        response.mustcontain("""<a href="/%s/files/fd4bdb5e9b2a29b4393a4ac6caef48c17ee1a200/">0.1.4</a>""" % HG_REPO)
        response.mustcontain("""<a href="/%s/files/17544fbfcd33ffb439e2b728b5d526b1ef30bfcf/">0.1.3</a>""" % HG_REPO)
        response.mustcontain("""<a href="/%s/files/a7e60bff65d57ac3a1a1ce3b12a70f8a9e8a7720/">0.1.2</a>""" % HG_REPO)
        response.mustcontain("""<a href="/%s/files/eb3a60fc964309c1a318b8dfe26aa2d1586c85ae/">0.1.1</a>""" % HG_REPO)
