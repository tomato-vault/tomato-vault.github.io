require 'json'
require 'fileutils'

module Jekyll
  class PostsJsonGenerator < Generator
    safe true

    def generate(site)
      posts = site.posts.docs.map do |post|
        if post.data['layout']
          {
            title: post.data['title'],
            url: post.url,
            date: post.date,
            categories: post.data['categories'],
            tags: post.data['tags'],
            image: post.data['image']
          }
        end
      end.compact 

      page = PageWithoutAFile.new(site, site.source, "", "posts.json")
      page.content = JSON.pretty_generate(posts)
      page.data['layout'] = nil
      site.pages << page
    end
  end
end
