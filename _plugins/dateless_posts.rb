# frozen_string_literal: true

module Jekyll
  class PostReader
    # Allow posts in _posts with or without leading date in filename.
    # When filename does not contain date, Jekyll reads date from YAML front matter.
    def read_posts(dir)
      read_publishable(dir, "_posts", //)
    end
  end
end
