const fs = require('fs');
const path = require('path');
const {Transform} = require('stream');
const config = require('../config.js');
const iconv = require('iconv-lite');

function MyStream(output_path,success,fail) {
    //目标流
    let write_stream = null,
        middle_layers = [],
        pipers = [],
        pipe_methods = [],
        files = [];

    this.add_target_path = function (file_path) {
        files.push(file_path);
    };

    this.add_pipe_method = function (pipe_method) {
        pipe_methods.push(pipe_method);
    };

    //增加中间层处理
    this.add_middler = function (middler) {
        let middler_type = Object.prototype.toString.call(middler);
        if (middler_type === '[object Function]' && middle_layers.indexOf(middler) === -1) {
            middle_layers.push(middler);
        }
    };
    //增加中间层处理
    this.add_piper = function (piper) {
        pipers.push(piper);
    };

    //开始写文件
    this.start_write = function () {
        let length = files.length;
        if (!length) {
            return;
        }
        write_stream = fs.createWriteStream(output_path);
        write_stream.on('finish', function () {
            console.log('文件拷贝完成');
            let success_type = Object.prototype.toString.call(success);
            if(success_type === '[object Function]'){
                success();
            }
            console.log(`当前时间${Date.now()}`)
        });
        write_stream.on('error', function (error) {
            console.error('write_stream error', error.message);
            let fail_type = Object.prototype.toString.call(fail);
            if(fail_type === '[object Function]'){
                fail();
            }
        });
        write(files);
    };

    const write = function (file_arr) {

        let file = file_arr.shift(),
            speed = Object.prototype.toString.call(config.speed) === '[object Array]' && config.speed.indexOf(file) !== -1,
            fileReadStream = fs.createReadStream(file);
        if (speed) {
            //对文件加速构建，不处理中间过程
            fileReadStream.pipe(write_stream, {end: false});
        } else {
            // fileReadStream.pipe(remove_import()).pipe(write_stream, {end: false});
            // run_piper(run_middle_layer(fileReadStream, file), file).pipe(write_stream, {end: false});
            // run_middle_layer(fileReadStream, file).pipe(write_stream, {end: false});
            fileReadStream.pipe(get_transform(run_pipe_method, file)).pipe(write_stream, {end: false});
        }
        fileReadStream.on('data', function (chunk) {
            // fileReadStream.unpipe();
        });
        fileReadStream.on('end', function () {
            console.log(`文件${file}拷贝完成`);
            fileReadStream.unpipe();
            if (file_arr.length) {
                write(file_arr);
            } else {
                write_stream.end();
            }
        });
        fileReadStream.on('error', (error) => {
            console.error('readStream error', error.message);
        })
    };

    function run_middle_layer(read_stream, file) {
        if (middle_layers.length) {
            return middle_layers.reduce(function (prev, middle_layer, i) {
                return prev.pipe(get_transform(middle_layer, file));
            }, read_stream);
        } else {
            return read_stream;
        }
    }

    function run_pipe_method(str, file) {
        if (pipe_methods.length) {
            return pipe_methods.reduce(function (prev, pipe_method, i) {
                return pipe_method(prev, file);
            }, str);
        } else {
            return str;
        }
    }

    function run_piper(read_stream, file) {
        if (pipers.length) {
            return pipers.reduce(function (prev, piper, i) {
                return prev.pipe(piper());
            }, read_stream);
        } else {
            return read_stream;
        }

    }


    /*//获取stream转化流
    function get_transform(middle_layer, file) {
        return new Transform({
            transform(chunk, encoding, callback) {
                let result = middle_layer(chunk.toString(), file);
                this.push(result);
                callback();
            }
        });
    }*/

    /*//获取stream转化流
    function get_transform(middle_layer, file) {
        let chunk_string = [];
        return new Transform({
            transform(chunk, encoding, callback) {
                // let result = middle_layer(chunk.toString(), file);
                chunk_string.push(chunk.toString());
                // this.push(result);
                callback();
            },
            flush(callback) {
                let result = middle_layer(chunk_string.join(''),file);
                this.push(result);
                chunk_string = [];
                callback();
            }
        });
    }*/

    //获取stream转化流
    function get_transform(middle_layer, file) {
        let chunks = [],
            size = 0;
        return new Transform({
            transform(chunk, encoding, callback) {
                // let result = middle_layer(chunk.toString(), file);
                chunks.push(chunk);
                size += chunk.length;
                // this.push(result);
                callback();
            },
            flush(callback) {
                let buf = Buffer.concat(chunks, size);
                let result = middle_layer(iconv.decode(buf, 'utf8'), file);
                this.push(result);
                chunks = null;
                size = null;
                callback();
            }
        });
    }

}

MyStream.write_file = function (file_path, output_path, options = {}) {
    let file_read_stream = fs.createReadStream(file_path),
        write_stream = fs.createWriteStream(output_path);
    file_read_stream.pipe(write_stream, options.params || {});
    write_stream.on('finish', function () {
        if (Object.prototype.toString.call(options.finish) === '[object Function]') {
            options.finish();
        }

    });
    file_read_stream.on('error', function (error) {
        console.error('file_read_stream error', error.message);
        if (Object.prototype.toString.call(options.error) === '[object Function]') {
            options.error();
        }
    });
    write_stream.on('error', function (error) {
        console.error('write_stream error', error.message);
        if (Object.prototype.toString.call(options.error) === '[object Function]') {
            options.error();
        }
    });
};
module.exports = MyStream;