"use client";
import Image from "next/image";

const Home = () => {
  return (
    <div className="flex flex-col w-full h-screen items-center justify-center bg-black px-8">
      <div className="flex flex-col items-center space-y-2 -mt-16">
        <Image
          src="/aa.jpg"
          alt="aa"
          width={400}
          height={400}
          className="rounded-lg shadow-2xl"
        />
        <div className="text-left max-w-xl">
          <p className="text-white text-lg leading-relaxed">
            AA is back. <br /><br />
            If you're on aadrama dot com then you'd probably be interested to know that a group of old
            competitive players are scrimming regularly.
            <br /><br />
            Email discord@aadrama.com with subject "AADrama" and what your old AA / AADrama name was if you'd like an invite to the discord server.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
