use std::fs::File;
use std::io::prelude::*;

use std::env;

use std::time::Instant;

fn main() {
    let args: Vec<String> = env::args().collect();
    let file_path = args.get(1).expect("File path not specified.");
    let mut f =
        File::open(&file_path).expect(format!("File path {} not found", file_path).as_str());
    let mut buffer = Vec::new();
    f.read_to_end(&mut buffer)
        .expect("Failed to read file into buffer");

    let start = Instant::now();
    let mut n_msgs: u32 = 0;
    let mut msg_data_in_bytes: usize = 0;

    let msg_iter = mcap::MessageStream::new(&buffer).expect("Failed to create message iter");
    for message in msg_iter {
        let msg = message.unwrap();
        msg_data_in_bytes += msg.data.len();
        n_msgs += 1;
    }

    let duration = start.elapsed();
    println!(
        "Read {n_msgs} messages totalling {msg_data_in_bytes:.2e} bytes in {:?} seconds.",
        duration
    );
}
