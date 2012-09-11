# Get the directory that this configuration file exists in
dir = File.dirname(__FILE__)

# Compass configurations
sass_path = dir
css_path = File.join(dir, "..", "css")

# Require any additional compass plugins here.
images_dir = File.join(dir, "..", "img")
output_style = :compressed
environment = :production
