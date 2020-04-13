Vue.component("hill-card", {
  template:
    '\
  <div> \
    <button \
    v-on:click="view()" \
    v-on:mouseover="peak()" \
    v-on:mouseleave="hide()" \
    v-bind:style=\'{"margin-top" : ypos+"px", "margin-left" : xpos+"px"}\' \
    id="mapMountainButton"  \
    ><img src="./img/mountainIcon.png" width="32"></img></button>\
    <b-card no-body class="overflow-hidden" v-bind:style=\'{top: cardy+"%"}\' style = "transition: all .5s cubic-bezier(.25,.8,.25,1); "> \
      <b-row no-gutters> \
        <b-col md="6"> \
          <b-card-img v-bind:src="img" class="picHill"></b-card-img> \
        </b-col> \
        <b-col md="6"> \
          <b-card-body v-bind:title="name" v-bind:sub-title="\'Rating: \'+rating+\'/5 with \'+num_of_ratings+\' review(s)\'"> \
            <b-card-text> \
              <strong>Description: </strong>{{body}}<br><br>\
              <strong>Reviews: </strong> \
              <ul id="example-1"> \
                <li v-for="review in reviews"> \
                <em>"{{ review }}"</em>\
                </li> \
              </ul> \
            </b-card-text> \
          </b-card-body> \
        </b-col> \
      </b-row> \
      <div> \
      <button id="backMapButton" v-on:click="end()"><strong>Back to Map</strong></button><button id="writeReviewButton" v-on:click="showReview(name)"><strong>Write a Review</strong></button> \
      </div> \
    </b-card> \
  </div> \
  ',
  props: ["xpos", "ypos", "name", "rating", "img", "body", "cardy", "toggle_reviews", "num_of_ratings", "reviews"],

  data: function () {
    return {
      defaultHeight: 200,
      peakHeight: 116,
      showHeight: 40,
      display: false,
    };
  },

  methods: {
    view: function () {
      console.log("in hide: " + this.display);
      if (this.display == false) {
        this.display = true;
        this.cardy = this.showHeight;
      }
    },

    peak: function () {
      console.log("in peak: " + this.display);
      if (this.display == false) {
        this.cardy = this.peakHeight;
      }
    },

    hide: function () {
      console.log("in hide: " + this.display);
      if (this.display == false) {
        this.cardy = this.defaultHeight;
      }
    },

    end: function () {
      this.display = false;
      this.cardy = this.defaultHeight;
    },

    showReview: function (name) {
      this.$parent.showReview(name)
    },
  },
});

Vue.component("review-form", {
  template:
    ' \
  <div v-if="toggle_reviews == true">\
    <div id="review" > \
      <div style="margin-left: 30px"> \
      <h1> Leave a review. </h1> \
      <h2 style="color: grey;"> {{name}} </h2> <br>\
      <div> \
          \
              <div style="font-size: 16px;"> <strong>Comments:      </strong> \
              <input class="input" size="80" type="text" v-model="userComment" \
                  placeholder="What a great hill! We were able to blah blah ..."> \
                  </div>\
      </div> \
  </div> \
  \
    <!--Rankings div--> \
      <div style="margin-left: 30px; padding-top: 20px; font-size: 16px;"> \
            <strong>Rankings</strong>  \
            <div> \
                <div v-for="(ratings, type) in displayRatings"> \
                    <div class="col-lg-5 col-md-3 col-sm-4" style="margin-bottom: 10px; display: inline !important; width:500px; max-width:600px; height: 40px"> \
                        <div class="col-sm-4" style="width:275px; max-width:275px; margin-right: 30px"> \
                            <div style="display:inline !important;">{{ type }}: </div> \
                            <span style="display:inline !important;" class="d-flex" v-for="(status, index) in ratings"> \
                                <button \
                                    v-bind:class="{\'btn btn-default\': !displayRatings[type][index], \'btn btn-info\': displayRatings[type][index]}" \
                                    v-on:click="updateRatings(index, type)" style="border: grey solid 2px; border-radius:10px; padding: 8px; margin:2px;"> \
                                </button> \
                            </span> \
                        </div> \
                    </div> \
                </div> \
            </div> \
        </div> \
    \
    <div class="col-lg-5 col-md-3 col-sm-3" style="margin-top: 10px; margin-bottom: 10px; display: inline; height: 40px"> \
                <div> \
                    <button id="submitReviewButton" style="margin:2px;" v-on:click="getHillInfo(name)"> \
                        <strong>Submit</strong> \
                    </button> \
                    <button id="cancelReviewButton" style="margin:2px;" v-on:click="closeReview(name)"> \
                        <strong>Cancel</strong> \
                    </button> \
              </div> \
            </div> \
        </div> \
    </div> \
  </div> \
  ',
  props: [
    "hill",
    "key",
    "name",
    "rating",
    "reviews",
    "num_of_ratings",
    "toggle_reviews",
  ],
  data: function () {
    return {
      hillName: "",
      userComment: "",
      finalRatings: {},
      displayRatings: {
        accessibility: {
          "1": false,
          "2": false,
          "3": false,
          "4": false,
          "5": false,
        },
        fun: {
          "1": false,
          "2": false,
          "3": false,
          "4": false,
          "5": false,
        },
        size: {
          "1": false,
          "2": false,
          "3": false,
          "4": false,
          "5": false,
        },
        steepness: {
          "1": false,
          "2": false,
          "3": false,
          "4": false,
          "5": false,
        },
        crowdedness: {
          "1": false,
          "2": false,
          "3": false,
          "4": false,
          "5": false,
        },
        overall: {
          "1": false,
          "2": false,
          "3": false,
          "4": false,
          "5": false,
        },
      },
    };
  },
  methods: {
    updateRatings: function (index, type) {
      for (i = 1; i < 6; i++) {
        if (i <= index) {
          this.displayRatings[String(type)][String(i)] = true;
        } else {
          this.displayRatings[String(type)][String(i)] = false;
        }
      }
      this.finalRatings[String(type)] = index

    },
    getHillInfo: function (name) {
      // calculate average of submitted ratings
      let avgRating = 0
      avgRating += parseFloat(this.finalRatings["accessibility"])
      avgRating += parseFloat(this.finalRatings["fun"])
      avgRating += parseFloat(this.finalRatings["steepness"])
      avgRating += parseFloat(this.finalRatings["size"])
      avgRating += parseFloat(this.finalRatings["crowdedness"])
      avgRating += parseFloat(this.finalRatings["overall"])
      avgRating = Math.round((avgRating / 6) * 10) / 10;

      if (isNaN(avgRating) || this.userComment == "") {
        alert("Please make sure you filled out each area before submitting.")
        return
      }

      // update hill information
      let temp = this.num_of_ratings * this.rating
      this.num_of_ratings++
      let curRating = (temp + avgRating) / this.num_of_ratings
      this.rating = Math.round(curRating * 10) / 10
      this.$parent.getHillInfo(this.rating, this.num_of_ratings, this.name, this.userComment)
      //this.$emit('updatehill', this.rating, this.num_of_ratings, this.name, this.userComment)
    },

    closeReview: function (name) {
      this.$parent.closeReview(name);
    }
  },
});

new Vue({
  el: "#app",
  data: {
    firstName: "",
    lastName: "",
    newHillName: "",
    newHillImgURL: "",
    newHillXPos: "",
    newHillYPos: "",
    newHillBody: "",
    show_screen: "intro",
    bestHills: [{ "Name": "Hospital", "Location": "Medical Drive", "Rating": 5 },
    { "Name": "The Hill", "Location": "Observatory St", "Rating": 4 },
    { "Name": "Nursing School", "Location": "Catherine St", "Rating": 3 },
    { "Name": "Bursely", "Location": "Murfin Ave", "Rating": 2 }],

    trendingHills: [{ "Name": "Stadium", "Location": "Greene Ave", "Rating": 4 },
    { "Name": "The Hill", "Location": "Observatory St", "Rating": 4 },
    { "Name": "Mary Markley", "Location": "Washington Heights", "Rating": 3 }],

    newHills: [{ "Name": "Geddes Hill", "Location": "Geddes Ave", "Rating": 4 },
    { "Name": "South Quad", "Location": "East Madison St", "Rating": 3 },
    { "Name": "Washtenaw Hill", "Location": "Washtenaw Ave", "Rating": 4 },
    { "Name": "Wave Field", "Location": "Beal Ave", "Rating": 2 }],



    idCount: 1,
    defaultHeight: 200,
    display: false,
    hills: [
      {
        id: this.idCount++,
        name: "Lost Lake Nature Park",
        img:
          "https://cdn.mykidlist.com/wp-content/uploads/2018/02/02104824/Sledding-in-the-Western-Suburbs.jpg",
        rating: 4.2,
        toggle_reviews: false,
        num_of_ratings: 1,
        reviews: ["This is the GREATEST hill of all time!",],
        body:
          "After a while, finding that nothing more happened, she decided on going into the garden at once; but, alas for poor Alice! when she got to the door, she found she had forgotten the little golden key, and when she went back to the table for it, she found she could not possibly reach it: she could see it quite plainly through the glass, and she tried her best to climb up one of the legs of the table, but it was too slippery; and when she had tired herself out with trying, the poor little thing sat down and cried.",
        xpos: -200,
        ypos: -350,
        cardy: this.defaultHeight,
      },
      {
        id: this.idCount++,
        name: "Jesse Decker Park",
        rating: 3.6,
        toggle_reviews: false,
        num_of_ratings: 1,
        reviews: ["This is the WORST hill of all time!",],
        img:
          "https://www.tripsavvy.com/thmb/ui9PIMDo3EnSWB-R8RpkCAHTbl4=/2399x1250/filters:fill(auto,1)/GettyImages-548555663-592aad733df78cbe7e6b9031.jpg",
        body:
          "What the heck did you just frickin’ say about me, you little whiner? I’ll have you know I graduated top of my class in the Navy Seals, and I’ve been involved in numerous secret raids on Al-Quaeda, and I have over 300 confirmed kills. I am trained in gorilla warfare and I’m the top sniper in the entire US armed forces. You are nothing to me but just another target. I will wipe you the frick out with precision the likes of which has never been seen before on this Earth, mark my frickin’ words.",
        xpos: -300,
        ypos: 269,
        cardy: this.defaultHeight,
      },
      {
        id: this.idCount++,
        name: "Heritage Park Sledding Hill",
        rating: 4.9,
        toggle_reviews: false,
        num_of_ratings: 1,
        reviews: ["This is a very 'meh' hill...",],
        img:
          "https://res-4.cloudinary.com/dostuff-media/image/upload//w_1200,q_75,c_limit,f_auto/v1514596748/page-image-8275-848fbea0-530b-48d1-ad40-abe67ca95e28.jpg",
        body:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eget tellus eget urna ultrices efficitur sed sit amet tortor. Nunc velit magna, varius eu porttitor in, consequat nec quam. Ut venenatis ante id molestie fermentum. Suspendisse in nibh ut metus dignissim cursus. Mauris sollicitudin nisi cursus metus varius sodales. Mauris eget tempor lacus. Nam sed laoreet mauris. Suspendisse vehicula pretium congue. Integer id semper lorem. Nulla porta, tortor vitae condimentum commodo, lectus diam hendrerit est, ut ullamcorper justo lorem porta nibh.",
        xpos: 300,
        ypos: 100,
        cardy: this.defaultHeight,
      },
    ],
  },

  methods: {
    showReview: function (name) {
      console.log("in parent with name: " + name);
      debugger;
      this.hills.find(hill => {
        if (name == hill.name) {
          console.log("Old toggle state: " + hill.toggle_reviews);
          hill.toggle_reviews = true;
          console.log("New toggle state: " + hill.toggle_reviews);
        }
      })
      this.show_screen = "temp";
    },

    getHillInfo: function (updated_rating, num_of_ratings, hill_name, comment) {
      this.hills.find(hill => {
        if (hill_name == hill.name) {
          hill.reviews.push(comment)
          hill.rating = updated_rating
          console.log("new Rating: " + updated_rating)
          hill.num_of_ratings = num_of_ratings
          hill.toggle_reviews = false;
          this.show_screen = "map"

        }
      })
    },

    closeReview: function (name) {
      console.log("in parent with name: " + name);
      this.hills.find(hill => {
        if (name == hill.name) {
          this.show_screen = "map"
          hill.toggle_reviews = false;
        }
      })
    },

    submitHill: function () {
      console.log("HELLOOOOO")
      let newHill = {}
      newHill["id"] = this.idCount++;
      newHill["name"] = this.newHillName;
      newHill["rating"] = 0;
      newHill["num_of_ratings"] = 0;
      newHill["reviews"] = [];
      newHill["img"] = this.newHillImgURL;
      newHill["body"] = this.newHillBody;
      newHill["xpos"] = this.newHillXPos;
      newHill["ypos"] = this.newHillYPos;
      newHill["cardy"] = this.defaultHeight;
      this.hills.push(newHill);
      this.show_screen = 'map';
    },


    view: function (view) {
      if (view === 'leaderboard') {
        //top chart
        let tops = [];
        for (let i = 0; i < this.hills.length; ++i) {
          tops.push(this.hills[i]);
        }
        tops.sort(function (a, b) {
          return b.rating - a.rating;
        });
        console.log(tops);
        console.log(this.hills);
        this.bestHills = tops;

        //trending chart
        let trends = [];
        for (let i = 0; i < this.hills.length; ++i) {
          trends.push(this.hills[i]);
        }
        trends.sort(function (a, b) {
          return b.num_of_ratings - a.num_of_ratings;
        });
        this.trendingHills = trends;

        //new charts
        let newStuff = [];
        for (let i = this.hills.length - 1; i >= 0; --i) {
          newStuff.push(this.hills[i]);
        }
        this.newHills = newStuff;
        this.show_screen = view;
      }
      this.show_screen = view;

      //change view
    },


  },
});
