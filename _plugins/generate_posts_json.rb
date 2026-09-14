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

      root_output_file = File.join(site.source, 'posts.json')
      site_output_file = File.join(site.dest, 'posts.json')

      File.write(root_output_file, JSON.pretty_generate(posts))

      FileUtils.mkdir_p(File.dirname(site_output_file))
      File.write(site_output_file, JSON.pretty_generate(posts))

      site.keep_files ||= []
      site.keep_files << 'posts.json'
    end
  end
end
